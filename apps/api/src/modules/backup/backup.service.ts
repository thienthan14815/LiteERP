// VN: Phase 1 dùng Postgres. Có 2 chiến lược chạy pg_dump:
//   1) BACKUP_STRATEGY=docker (mặc định) → docker exec <container> pg_dump ...
//      → không cần cài pg_dump ở host, chỉ cần Docker.
//   2) BACKUP_STRATEGY=local  → gọi pg_dump có sẵn trên PATH của host.
// Khi migrate sang SQLite trong tương lai: thay `runDump` và filename extension,
// giữ nguyên flow upload Drive + insert BackupRecord + retention GFS.
import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BackupKind } from "@prisma/client";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaService } from "../../database/prisma.service";
import { BusinessError } from "../../common/exceptions/business.exception";
import { AuditLogService } from "../audit-logs/audit-logs.service";
import { DriveService } from "../drive/drive.service";
import { DriveFolder } from "../drive/drive-folder.enum";
import { BackupRepository } from "../../repository/backup.repository";
import type { AppConfig } from "../../config/configuration";

// Rule 3: driveFileId KHÔNG có trong response type — chỉ có ở audit log server.
export interface BackupResult {
  id: string;
  sizeBytes: number;
  filename: string;
  kind: BackupKind;
  uploadedAt: string;
  retention: { deleted: number; kept: number };
}

export interface BackupListItem {
  id: string;
  filename: string;
  sizeBytes: number;
  kind: BackupKind;
  createdAt: string;
}

// Retention policy GFS.
const KEEP_DAILY = 7;
const KEEP_WEEKLY = 4;
const KEEP_MONTHLY = 3;

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly drive: DriveService,
    private readonly repo: BackupRepository,
  ) {}

  async dumpAndUpload(): Promise<BackupResult> {
    const dbUrl = this.config.get("database", { infer: true }).url;
    if (!dbUrl) {
      throw new BusinessError(
        "BACKUP_UNAVAILABLE",
        "DATABASE_URL is not set — cannot run pg_dump",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const strategy = (process.env.BACKUP_STRATEGY ?? "docker").toLowerCase();
    const dockerContainer = process.env.BACKUP_DOCKER_CONTAINER ?? "refurb-postgres";

    const filename = this.buildFilename();
    const tmpPath = join(tmpdir(), filename);
    try {
      await this.runDump(strategy, dockerContainer, dbUrl, tmpPath);

      const stat = await fs.stat(tmpPath);
      if (stat.size === 0) {
        throw new BusinessError(
          "BACKUP_UNAVAILABLE",
          "pg_dump produced an empty file",
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      const buffer = await fs.readFile(tmpPath);

      const uploaded = await this.drive.uploadFile(
        buffer,
        filename,
        "application/sql",
        DriveFolder.BACKUP,
      );

      // Rule 4: mọi write đi qua $transaction — insert record + audit atomic.
      const record = await this.prisma.$transaction(async (tx) => {
        const rec = await this.repo.create(
          {
            driveFileId: uploaded.driveFileId,
            filename,
            sizeBytes: uploaded.sizeBytes,
            kind: BackupKind.DAILY,
          },
          tx,
        );
        await this.audit.record(
          {
            action: "backup.run",
            entityType: "Backup",
            entityId: uploaded.driveFileId,
            after: { filename, sizeBytes: uploaded.sizeBytes, recordId: rec.id },
          },
          tx,
        );
        return rec;
      });

      // Retention GFS chạy sau khi commit — nếu retention lỗi thì bản vừa upload
      // vẫn an toàn (đã có record trong DB + file trên Drive).
      const retention = await this.runRetention();

      // Rule 3: KHÔNG trả driveFileId.
      return {
        id: record.id,
        sizeBytes: uploaded.sizeBytes,
        filename,
        kind: record.kind,
        uploadedAt: record.createdAt.toISOString(),
        retention,
      };
    } finally {
      await fs.unlink(tmpPath).catch(() => undefined);
    }
  }

  async list(): Promise<BackupListItem[]> {
    const rows = await this.repo.findAllOrderedNewestFirst();
    return rows.map((r) => ({
      id: r.id,
      filename: r.filename,
      sizeBytes: r.sizeBytes,
      kind: r.kind,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async remove(id: string): Promise<{ deleted: true }> {
    const rec = await this.repo.findById(id);
    if (!rec) {
      throw new BusinessError("BACKUP_NOT_FOUND", "Backup record not found", HttpStatus.NOT_FOUND);
    }
    // Xoá Drive trước — nếu lỗi thì DB record vẫn tồn tại → có thể retry.
    // Idempotent: DriveService xử lý 404 = coi như đã xoá.
    await this.drive.deleteFile(rec.driveFileId);
    await this.prisma.$transaction(async (tx) => {
      await this.repo.deleteById(id, tx);
      await this.audit.record(
        {
          action: "backup.delete",
          entityType: "Backup",
          entityId: rec.driveFileId,
          before: { filename: rec.filename, sizeBytes: rec.sizeBytes },
        },
        tx,
      );
    });
    return { deleted: true };
  }

  /**
   * Retention Grandfather-Father-Son:
   *   - Giữ 7 daily gần nhất (mỗi ngày 1 bản mới nhất)
   *   - Giữ 4 weekly gần nhất (mỗi tuần 1 bản mới nhất — theo tuần ISO)
   *   - Giữ 3 monthly gần nhất (mỗi tháng 1 bản mới nhất)
   * Bất kỳ record nào KHÔNG rơi vào 3 tập trên → xoá Drive + DB.
   * Đồng thời tự phân loại (`kind`) mỗi record: WEEKLY nếu là bản đại diện tuần,
   * MONTHLY nếu là bản đại diện tháng, còn lại DAILY.
   */
  async runRetention(): Promise<{ deleted: number; kept: number }> {
    const all = await this.repo.findAllOrderedNewestFirst();
    if (all.length === 0) return { deleted: 0, kept: 0 };

    const dailyKeepers = new Set<string>();
    const weeklyKeepers = new Set<string>();
    const monthlyKeepers = new Set<string>();

    // Group theo day/week/month key (ISO). Vì `all` đã sort newest-first,
    // lần đầu bắt gặp key nào tức là bản mới nhất trong nhóm đó.
    const seenDay = new Map<string, string>();       // day-key → recordId
    const seenWeek = new Map<string, string>();      // ISO week-key → recordId
    const seenMonth = new Map<string, string>();     // month-key → recordId

    for (const r of all) {
      const d = r.createdAt;
      const dayKey = dayKeyOf(d);
      const weekKey = isoWeekKeyOf(d);
      const monthKey = monthKeyOf(d);
      if (!seenDay.has(dayKey)) seenDay.set(dayKey, r.id);
      if (!seenWeek.has(weekKey)) seenWeek.set(weekKey, r.id);
      if (!seenMonth.has(monthKey)) seenMonth.set(monthKey, r.id);
    }

    // Insertion order = mới nhất → cũ nhất; slice để lấy top-N.
    for (const id of Array.from(seenDay.values()).slice(0, KEEP_DAILY)) dailyKeepers.add(id);
    for (const id of Array.from(seenWeek.values()).slice(0, KEEP_WEEKLY)) weeklyKeepers.add(id);
    for (const id of Array.from(seenMonth.values()).slice(0, KEEP_MONTHLY)) monthlyKeepers.add(id);

    const keep = new Set<string>([...dailyKeepers, ...weeklyKeepers, ...monthlyKeepers]);
    const toDelete = all.filter((r) => !keep.has(r.id));

    // Xoá trên Drive song song (best-effort). Nếu lỗi mạng lẻ tẻ vẫn tiếp tục.
    const results = await Promise.allSettled(
      toDelete.map((r) => this.drive.deleteFile(r.driveFileId)),
    );
    const successfulIds = toDelete
      .filter((_, i) => results[i]?.status === "fulfilled")
      .map((r) => r.id);
    const failedCount = toDelete.length - successfulIds.length;
    if (failedCount > 0) {
      this.logger.warn(
        `Retention: ${failedCount}/${toDelete.length} deletions failed on Drive — DB rows kept for retry`,
      );
    }

    // Xoá DB record + reclassify kind cho các keeper. Bọc trong 1 transaction.
    await this.prisma.$transaction(async (tx) => {
      if (successfulIds.length > 0) await this.repo.deleteByIds(successfulIds, tx);
      for (const r of all) {
        if (!keep.has(r.id)) continue;
        const expected = monthlyKeepers.has(r.id)
          ? BackupKind.MONTHLY
          : weeklyKeepers.has(r.id)
            ? BackupKind.WEEKLY
            : BackupKind.DAILY;
        if (r.kind !== expected) await this.repo.updateKind(r.id, expected, tx);
      }
      await this.audit.record(
        {
          action: "backup.retention",
          entityType: "Backup",
          entityId: "*",
          after: {
            kept: keep.size,
            deleted: successfulIds.length,
            failedDelete: failedCount,
          },
        },
        tx,
      );
    });

    return { deleted: successfulIds.length, kept: keep.size };
  }

  private buildFilename(): string {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
    return `app-${stamp}.sql`;
  }

  private async runDump(
    strategy: string,
    dockerContainer: string,
    dbUrl: string,
    outPath: string,
  ): Promise<void> {
    if (strategy === "docker") {
      await this.runDumpViaDocker(dockerContainer, outPath);
    } else {
      await this.assertPgDumpAvailable();
      await this.runDumpLocal(dbUrl, outPath);
    }
  }

  private runDumpViaDocker(container: string, outPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // docker exec <container> pg_dump -U app --no-owner --no-privileges app
      // → pipe stdout về Node để ghi ra file. Không dùng -T (đó là flag của
      // docker-compose, không phải docker CLI). Docker CLI mặc định KHÔNG cấp
      // TTY nếu không có -t, đúng cho stream stdout binary.
      const args = [
        "exec",
        container,
        "pg_dump",
        "-U",
        "app",
        "--no-owner",
        "--no-privileges",
        "app",
      ];
      const child = spawn("docker", args, { shell: process.platform === "win32" });
      const chunks: Buffer[] = [];
      let stderr = "";
      child.stdout.on("data", (d: Buffer) => chunks.push(d));
      child.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
      child.on("error", (err) =>
        reject(
          new BusinessError(
            "BACKUP_UNAVAILABLE",
            `docker exec spawn error: ${err.message}. Đảm bảo Docker Desktop chạy và container ${container} tồn tại.`,
            HttpStatus.SERVICE_UNAVAILABLE,
          ),
        ),
      );
      child.on("close", async (code) => {
        if (code !== 0) {
          reject(
            new BusinessError(
              "BACKUP_UNAVAILABLE",
              `docker exec pg_dump exited with code ${code}: ${stderr.slice(0, 500)}`,
              HttpStatus.INTERNAL_SERVER_ERROR,
            ),
          );
          return;
        }
        try {
          await fs.writeFile(outPath, Buffer.concat(chunks));
          resolve();
        } catch (err) {
          reject(
            new BusinessError(
              "BACKUP_UNAVAILABLE",
              `Failed to write dump to disk: ${(err as Error).message}`,
              HttpStatus.INTERNAL_SERVER_ERROR,
            ),
          );
        }
      });
    });
  }

  private assertPgDumpAvailable(): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn("pg_dump", ["--version"], { shell: true });
      let stderr = "";
      child.stderr.on("data", (d) => (stderr += d.toString()));
      child.on("error", () =>
        reject(
          new BusinessError(
            "BACKUP_UNAVAILABLE",
            "pg_dump không có trên host. Đổi BACKUP_STRATEGY=docker hoặc cài PostgreSQL client tools.",
            HttpStatus.SERVICE_UNAVAILABLE,
          ),
        ),
      );
      child.on("close", (code) => {
        if (code === 0) return resolve();
        reject(
          new BusinessError(
            "BACKUP_UNAVAILABLE",
            `pg_dump --version exit ${code}: ${stderr}`,
            HttpStatus.SERVICE_UNAVAILABLE,
          ),
        );
      });
    });
  }

  private runDumpLocal(dbUrl: string, outPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = ["--no-owner", "--no-privileges", "-f", outPath, dbUrl];
      const child = spawn("pg_dump", args, { shell: true });
      let stderr = "";
      child.stderr.on("data", (d) => (stderr += d.toString()));
      child.on("error", (err) =>
        reject(
          new BusinessError(
            "BACKUP_UNAVAILABLE",
            `pg_dump spawn error: ${err.message}`,
            HttpStatus.INTERNAL_SERVER_ERROR,
          ),
        ),
      );
      child.on("close", (code) => {
        if (code === 0) return resolve();
        reject(
          new BusinessError(
            "BACKUP_UNAVAILABLE",
            `pg_dump exited with code ${code}: ${stderr.slice(0, 500)}`,
            HttpStatus.INTERNAL_SERVER_ERROR,
          ),
        );
      });
    });
  }
}

// -----------------------------------------------------------------------------
// Helpers — pure, testable, không phụ thuộc runtime.
// -----------------------------------------------------------------------------

function dayKeyOf(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function monthKeyOf(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
}

// ISO week: tuần bắt đầu Thứ 2, W01 = tuần chứa Thứ Năm đầu tiên trong năm.
function isoWeekKeyOf(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (t.getUTCDay() + 6) % 7; // 0=Mon
  t.setUTCDate(t.getUTCDate() - dayNum + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const diff = (t.getTime() - firstThursday.getTime()) / 86400000;
  const weekNum = 1 + Math.round((diff - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${t.getUTCFullYear()}-W${pad2(weekNum)}`;
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}
