import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { CronJob } from "cron";
import { BackupService } from "./backup.service";
import { DriveService } from "../drive/drive.service";

// VN: Scheduler đăng ký cron động (không dùng @Cron decorator) để có thể đọc
// biểu thức cron từ env vào lúc runtime. Mặc định 03:00 hàng ngày, giờ máy chủ.
// Tắt bằng BACKUP_ENABLED=false.
const JOB_NAME = "backup-daily";
const DEFAULT_CRON = "0 3 * * *";
const DEFAULT_CATCHUP_HOURS = 24;

@Injectable()
export class BackupScheduler implements OnModuleInit {
  private readonly logger = new Logger(BackupScheduler.name);

  constructor(
    private readonly registry: SchedulerRegistry,
    private readonly backup: BackupService,
    private readonly drive: DriveService,
  ) {}

  onModuleInit(): void {
    const enabled = (process.env.BACKUP_ENABLED ?? "true").toLowerCase() !== "false";
    if (!enabled) {
      this.logger.warn("BACKUP_ENABLED=false — bỏ qua đăng ký scheduler.");
      return;
    }
    const cron = process.env.BACKUP_CRON ?? DEFAULT_CRON;
    const timeZone = process.env.BACKUP_TIMEZONE ?? "Asia/Ho_Chi_Minh";
    let job: CronJob;
    try {
      job = new CronJob(cron, () => this.tick(), null, false, timeZone);
    } catch (err) {
      this.logger.error(
        `BACKUP_CRON không hợp lệ: "${cron}". Job KHÔNG được đăng ký. ${(err as Error).message}`,
      );
      return;
    }
    this.registry.addCronJob(JOB_NAME, job as unknown as CronJob);
    job.start();
    this.logger.log(
      `Scheduler backup đã đăng ký: cron="${cron}" tz="${timeZone}" (next=${job.nextDate().toISO()}).`,
    );

    // Catch-up: on a device the process may be down at 03:00, so a scheduled
    // run is simply skipped (cron does not replay). If the last backup is older
    // than the catch-up window, run one now. Not awaited — never block boot.
    void this.maybeCatchUp();
  }

  /** Run a backup at startup if none happened within BACKUP_CATCHUP_HOURS. */
  private async maybeCatchUp(): Promise<void> {
    try {
      const catchupEnabled =
        (process.env.BACKUP_CATCHUP_ENABLED ?? "true").toLowerCase() !== "false";
      if (!catchupEnabled) return;
      if (!this.drive.isConfigured()) {
        this.logger.warn("Backup catch-up bỏ qua: Google Drive chưa cấu hình.");
        return;
      }
      const hours = Number(process.env.BACKUP_CATCHUP_HOURS ?? DEFAULT_CATCHUP_HOURS);
      const items = await this.backup.list();
      const newest = items[0];
      const ageMs = newest ? Date.now() - new Date(newest.createdAt).getTime() : Infinity;
      if (ageMs < hours * 3600_000) {
        this.logger.log(
          `Backup catch-up: bản gần nhất ${Math.round(ageMs / 3600_000)}h trước (<${hours}h) — bỏ qua.`,
        );
        return;
      }
      this.logger.warn(
        `Backup catch-up: chưa có bản backup trong ${hours}h — chạy bù ngay.`,
      );
      const result = await this.backup.dumpAndUpload();
      this.logger.log(`Backup catch-up OK: ${result.filename} (${result.sizeBytes} B).`);
    } catch (err) {
      this.logger.error(`Backup catch-up THẤT BẠI: ${(err as Error).message}`);
    }
  }

  private async tick(): Promise<void> {
    try {
      const t0 = Date.now();
      const result = await this.backup.dumpAndUpload();
      const ms = Date.now() - t0;
      this.logger.log(
        `Backup định kỳ OK: ${result.filename} (${result.sizeBytes} B) — retention kept=${result.retention.kept} deleted=${result.retention.deleted} [${ms}ms]`,
      );
    } catch (err) {
      this.logger.error(`Backup định kỳ THẤT BẠI: ${(err as Error).message}`);
    }
  }
}
