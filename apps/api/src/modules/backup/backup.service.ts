// VN: SQLite backup:
//   1) `PRAGMA wal_checkpoint(TRUNCATE)` để đảm bảo WAL đã flush vào file DB.
//   2) `fs.copyFile` file .sqlite → tmp path.
//   3) Nén thành .zip qua adm-zip (đã có sẵn dep).
//   4) Upload Drive + insert BackupRecord + retention GFS (giữ nguyên logic cũ).
// Restore: giải nén .zip → file .sqlite → ghi đè file DB hiện hành. Yêu cầu
// restart process vì connection sqlite3 vẫn giữ file handle cũ.
import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BackupKind } from "@app/shared";
import AdmZip from "adm-zip";
import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { DbService } from "../../database/db.service";
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
    private readonly dbs: DbService,
    private readonly audit: AuditLogService,
    private readonly drive: DriveService,
    private readonly repo: BackupRepository,
  ) {}

  async dumpAndUpload(): Promise<BackupResult> {
    const dbPath = await this.resolveDbPath();

    const sqliteFilename = this.buildSqliteFilename();
    const zipFilename = this.buildZipFilename();
    // Temp copy sống cạnh file DB thay vì os.tmpdir(): trên Android không có
    // /tmp ghi được (EACCES), còn thư mục chứa DB thì chắc chắn ghi được.
    const tmpDbPath = join(dirname(dbPath), `.backup-${sqliteFilename}`);
    try {
      // 1) Checkpoint WAL để .sqlite đứng yên đủ dữ liệu để copy nguyên tử.
      //    TRUNCATE nén WAL về 0 byte sau khi flush.
      await this.dbs.queryRaw("PRAGMA wal_checkpoint(TRUNCATE)");
      // 2) Copy file DB (SQLite chấp nhận copy khi WAL đã checkpoint).
      await fs.copyFile(dbPath, tmpDbPath);

      const stat = await fs.stat(tmpDbPath);
      if (stat.size === 0) {
        throw new BusinessError(
          "BACKUP_UNAVAILABLE",
          "SQLite database file is empty",
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      const dbBuffer = await fs.readFile(tmpDbPath);

      // 3) Gói .sqlite vào .zip — SQLite nén khá tốt (thường 2-4x nhỏ hơn).
      const zip = new AdmZip();
      zip.addFile(sqliteFilename, dbBuffer);
      const zipBuffer = zip.toBuffer();

      // 4) Upload lên Drive.
      const uploaded = await this.drive.uploadFile(
        zipBuffer,
        zipFilename,
        "application/zip",
        DriveFolder.BACKUP,
      );
      const filename = zipFilename;

      // Rule 4: mọi write đi qua transaction — insert record + audit atomic.
      const record = await this.dbs.transaction(async (db) => {
        const rec = await this.repo.create(
          {
            driveFileId: uploaded.driveFileId,
            filename,
            sizeBytes: uploaded.sizeBytes,
            kind: BackupKind.DAILY,
          },
          db,
        );
        await this.audit.record(
          {
            action: "backup.run",
            entityType: "Backup",
            entityId: uploaded.driveFileId,
            after: { filename, sizeBytes: uploaded.sizeBytes, recordId: rec.id },
          },
          db,
        );
        return rec;
      });

      // Retention GFS: mặc định TẮT — user muốn giữ toàn bộ backup trên Drive.
      const retentionEnabled =
        (process.env.BACKUP_RETENTION_ENABLED ?? "false").toLowerCase() === "true";
      const retention = retentionEnabled
        ? await this.runRetention()
        : { kept: await this.countAllBackups(), deleted: 0 };

      // Rule 3: KHÔNG trả driveFileId.
      return {
        id: record.id,
        sizeBytes: uploaded.sizeBytes,
        filename,
        kind: record.kind as BackupKind,
        uploadedAt: record.createdAt.toISOString(),
        retention,
      };
    } finally {
      await fs.unlink(tmpDbPath).catch(() => undefined);
    }
  }

  private async countAllBackups(): Promise<number> {
    const rows = await this.repo.findAllOrderedNewestFirst();
    return rows.length;
  }

  async list(): Promise<BackupListItem[]> {
    const rows = await this.repo.findAllOrderedNewestFirst();
    return rows.map((r) => ({
      id: r.id,
      filename: r.filename,
      sizeBytes: r.sizeBytes,
      kind: r.kind as BackupKind,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /**
   * Phục hồi DB từ file .zip (chứa .sqlite) hoặc .sqlite thuần.
   * DANGEROUS: ghi đè file DB hiện hành, cần restart process để sqlite3 mở lại.
   * Chỉ ADMIN được gọi (guard ở controller).
   */
  async restore(
    file: { originalname: string; mimetype: string; buffer: Buffer },
  ): Promise<{ restoredFrom: string; sizeBytes: number; durationMs: number }> {
    const t0 = Date.now();
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BusinessError(
        "RESTORE_INVALID_FILE",
        "File phục hồi trống hoặc không hợp lệ",
        HttpStatus.BAD_REQUEST,
      );
    }

    const lname = (file.originalname ?? "").toLowerCase();
    let dbBuffer: Buffer;
    if (lname.endsWith(".zip")) {
      try {
        const zip = new AdmZip(file.buffer);
        const entries = zip
          .getEntries()
          .filter(
            (e) =>
              !e.isDirectory &&
              (e.entryName.toLowerCase().endsWith(".sqlite") ||
                e.entryName.toLowerCase().endsWith(".db")),
          );
        if (entries.length === 0) {
          throw new BusinessError(
            "RESTORE_INVALID_FILE",
            "File .zip không chứa file .sqlite nào",
            HttpStatus.BAD_REQUEST,
          );
        }
        dbBuffer = entries[0].getData();
      } catch (err) {
        if (err instanceof BusinessError) throw err;
        throw new BusinessError(
          "RESTORE_INVALID_FILE",
          `Không giải nén được .zip: ${(err as Error).message}`,
          HttpStatus.BAD_REQUEST,
        );
      }
    } else if (lname.endsWith(".sqlite") || lname.endsWith(".db")) {
      dbBuffer = file.buffer;
    } else {
      throw new BusinessError(
        "RESTORE_INVALID_FILE",
        "Chỉ nhận .sqlite/.db hoặc .zip (chứa .sqlite)",
        HttpStatus.BAD_REQUEST,
      );
    }

    if (dbBuffer.length === 0) {
      throw new BusinessError(
        "RESTORE_INVALID_FILE",
        "File SQLite trống sau khi giải nén",
        HttpStatus.BAD_REQUEST,
      );
    }

    // Sanity check magic bytes: SQLite v3 file bắt đầu "SQLite format 3\0".
    const magic = dbBuffer.slice(0, 16).toString("utf8");
    if (!magic.startsWith("SQLite format 3")) {
      throw new BusinessError(
        "RESTORE_INVALID_FILE",
        "File không phải database SQLite hợp lệ (magic bytes sai)",
        HttpStatus.BAD_REQUEST,
      );
    }

    const dbPath = await this.resolveDbPath();

    // Ghi file phục hồi ra cạnh DB rồi PRAGMA integrity_check trên một
    // connection riêng TRƯỚC khi đụng vào DB thật — magic bytes đúng vẫn có
    // thể là file đứt gãy (đã xảy ra thật: copy DB đang mở giữa chừng),
    // ghi đè thẳng sẽ phá DB không cứu được.
    const incomingPath = `${dbPath}.incoming`;
    try {
      await fs.writeFile(incomingPath, dbBuffer);
      await this.dbs.verifySqliteFile(incomingPath);
    } catch (err) {
      await fs.unlink(incomingPath).catch(() => undefined);
      throw new BusinessError(
        "RESTORE_INVALID_FILE",
        `File phục hồi không phải database SQLite lành lặn: ${(err as Error).message}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Audit TRƯỚC khi restore (vì restore sẽ ghi đè cả bảng audit_logs).
    // Best-effort: nếu DB hiện tại đã hỏng thì restore chính là đường cứu —
    // không để bước audit chặn nó.
    await this.audit
      .record({
        action: "backup.restore.start",
        entityType: "Backup",
        entityId: "*",
        after: { filename: file.originalname, sizeBytes: dbBuffer.length },
      })
      .catch((err) =>
        this.logger.warn(`audit backup.restore.start failed (continuing): ${(err as Error).message}`),
      );

    // Checkpoint + ĐÓNG hẳn connection trước khi ghi đè (tương đương
    // $disconnect() của Prisma trước đây). Trong cửa sổ close→reopen mọi
    // request khác chạm DB sẽ lỗi — chấp nhận được cho app single-user.
    // Checkpoint best-effort vì DB hiện tại có thể đã hỏng.
    await this.dbs.queryRaw("PRAGMA wal_checkpoint(TRUNCATE)").catch(() => undefined);
    await this.dbs.close();

    // Giữ bản DB trước-restore để quay về được nếu bản mới không mở nổi,
    // rồi swap file (rename cùng thư mục = atomic) + xoá WAL/SHM cũ.
    const preRestorePath = `${dbPath}.pre-restore`;
    try {
      await fs.copyFile(dbPath, preRestorePath).catch(() => undefined);
      await fs.rename(incomingPath, dbPath);
      await fs.unlink(`${dbPath}-journal`).catch(() => undefined);
      await fs.unlink(`${dbPath}-wal`).catch(() => undefined);
      await fs.unlink(`${dbPath}-shm`).catch(() => undefined);
    } catch (err) {
      await fs.unlink(incomingPath).catch(() => undefined);
      // Mở lại connection kể cả khi ghi đè thất bại — DB cũ vẫn nguyên vẹn.
      await this.dbs.reopen().catch(() => undefined);
      throw new BusinessError(
        "RESTORE_FAILED",
        `Không ghi được file DB: ${(err as Error).message}. Cần restart process API.`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    await this.dbs.reopen();

    // Probe đọc trên DB vừa restore — nếu không đọc được thì quay về bản
    // trước-restore thay vì để hệ thống sống trên DB chết.
    try {
      await this.dbs.queryRaw("SELECT 1 FROM users LIMIT 1");
    } catch (err) {
      await this.dbs.close().catch(() => undefined);
      await fs.copyFile(preRestorePath, dbPath).catch(() => undefined);
      await fs.unlink(preRestorePath).catch(() => undefined);
      await this.dbs.reopen().catch(() => undefined);
      throw new BusinessError(
        "RESTORE_FAILED",
        `DB sau phục hồi không đọc được (${(err as Error).message}) — đã quay về dữ liệu trước đó.`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    await fs.unlink(preRestorePath).catch(() => undefined);

    // Audit "done" ghi qua connection MỚI vào DB vừa restore. BEST-EFFORT:
    // khi restore backup từ máy KHÁC (đồng bộ PC ↔ điện thoại), actor user id
    // trong request context là id của DB CŨ — không tồn tại trong DB mới →
    // FK violation. Restore lúc này đã xong; không để bước ghi log biến một
    // ca thành công thành lỗi 500 (bug thật đã gặp trên thiết bị 2026-07-07).
    await this.audit
      .record({
        action: "backup.restore.done",
        entityType: "Backup",
        entityId: "*",
        after: {
          filename: file.originalname,
          sizeBytes: dbBuffer.length,
          durationMs: Date.now() - t0,
          note: "Restart API process to ensure clean handles",
        },
      })
      .catch((err) =>
        this.logger.warn(
          `audit backup.restore.done failed (restore itself SUCCEEDED): ${(err as Error).message}`,
        ),
      );

    return {
      restoredFrom: file.originalname,
      sizeBytes: dbBuffer.length,
      durationMs: Date.now() - t0,
    };
  }

  async remove(id: string): Promise<{ deleted: true }> {
    const rec = await this.repo.findById(id);
    if (!rec) {
      throw new BusinessError("BACKUP_NOT_FOUND", "Backup record not found", HttpStatus.NOT_FOUND);
    }
    await this.drive.deleteFile(rec.driveFileId);
    await this.dbs.transaction(async (db) => {
      await this.repo.deleteById(id, db);
      await this.audit.record(
        {
          action: "backup.delete",
          entityType: "Backup",
          entityId: rec.driveFileId,
          before: { filename: rec.filename, sizeBytes: rec.sizeBytes },
        },
        db,
      );
    });
    return { deleted: true };
  }

  /**
   * Retention Grandfather-Father-Son:
   *   - Giữ 7 daily gần nhất (mỗi ngày 1 bản mới nhất)
   *   - Giữ 4 weekly gần nhất (mỗi tuần 1 bản mới nhất — theo tuần ISO)
   *   - Giữ 3 monthly gần nhất (mỗi tháng 1 bản mới nhất)
   */
  async runRetention(): Promise<{ deleted: number; kept: number }> {
    const all = await this.repo.findAllOrderedNewestFirst();
    if (all.length === 0) return { deleted: 0, kept: 0 };

    const dailyKeepers = new Set<string>();
    const weeklyKeepers = new Set<string>();
    const monthlyKeepers = new Set<string>();

    const seenDay = new Map<string, string>();
    const seenWeek = new Map<string, string>();
    const seenMonth = new Map<string, string>();

    for (const r of all) {
      const d = r.createdAt;
      const dayKey = dayKeyOf(d);
      const weekKey = isoWeekKeyOf(d);
      const monthKey = monthKeyOf(d);
      if (!seenDay.has(dayKey)) seenDay.set(dayKey, r.id);
      if (!seenWeek.has(weekKey)) seenWeek.set(weekKey, r.id);
      if (!seenMonth.has(monthKey)) seenMonth.set(monthKey, r.id);
    }

    for (const id of Array.from(seenDay.values()).slice(0, KEEP_DAILY)) dailyKeepers.add(id);
    for (const id of Array.from(seenWeek.values()).slice(0, KEEP_WEEKLY)) weeklyKeepers.add(id);
    for (const id of Array.from(seenMonth.values()).slice(0, KEEP_MONTHLY)) monthlyKeepers.add(id);

    const keep = new Set<string>([...dailyKeepers, ...weeklyKeepers, ...monthlyKeepers]);
    const toDelete = all.filter((r) => !keep.has(r.id));

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

    await this.dbs.transaction(async (db) => {
      if (successfulIds.length > 0) await this.repo.deleteByIds(successfulIds, db);
      for (const r of all) {
        if (!keep.has(r.id)) continue;
        const expected = monthlyKeepers.has(r.id)
          ? BackupKind.MONTHLY
          : weeklyKeepers.has(r.id)
            ? BackupKind.WEEKLY
            : BackupKind.DAILY;
        if (r.kind !== expected) await this.repo.updateKind(r.id, expected, db);
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
        db,
      );
    });

    return { deleted: successfulIds.length, kept: keep.size };
  }

  private buildSqliteFilename(): string {
    return `app-${this.stamp()}.sqlite`;
  }

  private buildZipFilename(): string {
    return `app-${this.stamp()}.zip`;
  }

  private stamp(): string {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  }

  // Trả về đường dẫn tuyệt đối của file .sqlite mà SQLite đang mở.
  // `PRAGMA database_list` là cách chính thức lấy path — không phụ thuộc cwd
  // hay format của DATABASE_URL. Row.name === 'main' = DB chính.
  private async resolveDbPath(): Promise<string> {
    type Row = { seq: number; name: string; file: string };
    const rows = await this.dbs.queryRaw<Row>("PRAGMA database_list");
    const main = rows.find((r) => r.name === "main");
    if (!main || !main.file) {
      throw new BusinessError(
        "BACKUP_UNAVAILABLE",
        "Không xác định được đường dẫn file SQLite (PRAGMA database_list trống). Kiểm tra DATABASE_URL.",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return main.file;
  }
}

// -----------------------------------------------------------------------------
// Helpers — pure, testable.
// -----------------------------------------------------------------------------

export function dayKeyOf(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

export function monthKeyOf(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
}

export function isoWeekKeyOf(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const diff = (t.getTime() - firstThursday.getTime()) / 86400000;
  const weekNum = 1 + Math.round((diff - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${t.getUTCFullYear()}-W${pad2(weekNum)}`;
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}
