import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { CronJob } from "cron";
import { BackupService } from "./backup.service";

// VN: Scheduler đăng ký cron động (không dùng @Cron decorator) để có thể đọc
// biểu thức cron từ env vào lúc runtime. Mặc định 03:00 hàng ngày, giờ máy chủ.
// Tắt bằng BACKUP_ENABLED=false.
const JOB_NAME = "backup-daily";
const DEFAULT_CRON = "0 3 * * *";

@Injectable()
export class BackupScheduler implements OnModuleInit {
  private readonly logger = new Logger(BackupScheduler.name);

  constructor(
    private readonly registry: SchedulerRegistry,
    private readonly backup: BackupService,
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
