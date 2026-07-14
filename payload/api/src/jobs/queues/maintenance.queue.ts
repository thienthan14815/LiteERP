import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { DbService } from "../../database/db.service";
import { components } from "../../database/schema";

const LOW_STOCK_THRESHOLD = 3;

// In-process replacement for the former BullMQ queue (Redis removed for the
// single-process / on-device deployment). Same public API as before.
@Injectable()
export class MaintenanceQueueService {
  private readonly logger = new Logger(MaintenanceQueueService.name);

  constructor(private readonly dbs: DbService) {}

  async enqueueBackupDatabase() {
    const id = randomUUID();
    setImmediate(() => {
      // Real backups run through BackupService (scheduler / POST endpoint);
      // the former BullMQ worker was a stub here too, kept as a log for parity.
      this.logger.log("backup-database requested — use BackupService for real dumps");
    });
    return id;
  }

  async enqueueLowStockAlert() {
    const id = randomUUID();
    setImmediate(async () => {
      try {
        const counts = await this.dbs.db
          .select({
            categoryId: components.categoryId,
            count: sql<number>`count(*)`.as("count"),
          })
          .from(components)
          .where(eq(components.status, "IN_STOCK"))
          .groupBy(components.categoryId);
        const low = counts.filter((c) => Number(c.count) < LOW_STOCK_THRESHOLD);
        this.logger.log(
          `Low-stock categories (<${LOW_STOCK_THRESHOLD}): ${low
            .map((c) => `${c.categoryId}=${Number(c.count)}`)
            .join(", ")}`,
        );
      } catch (err) {
        this.logger.error(
          `low-stock-alert failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    });
    return id;
  }
}
