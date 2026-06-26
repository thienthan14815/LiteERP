import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { Queue, Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { getRedisConnection } from "./redis-connection";

export const MAINTENANCE_QUEUE = "maintenance";

const LOW_STOCK_THRESHOLD = 3;

@Injectable()
export class MaintenanceQueueService implements OnModuleDestroy {
  private readonly queue: Queue;

  constructor() {
    this.queue = new Queue(MAINTENANCE_QUEUE, { connection: getRedisConnection() });
  }

  async enqueueBackupDatabase() {
    const job = await this.queue.add("backup-database", {}, {
      removeOnComplete: 50,
      removeOnFail: 50,
    });
    return job.id;
  }

  async enqueueLowStockAlert() {
    const job = await this.queue.add("low-stock-alert", { threshold: LOW_STOCK_THRESHOLD }, {
      removeOnComplete: 50,
      removeOnFail: 50,
    });
    return job.id;
  }

  async onModuleDestroy() {
    await this.queue.close();
  }
}

export function startMaintenanceWorker() {
  const logger = new Logger("MaintenanceWorker");
  return new Worker(
    MAINTENANCE_QUEUE,
    async (job) => {
      if (job.name === "backup-database") {
        logger.log("Stub backup-database: would dump postgres to MinIO here");
        return { ok: true };
      }
      if (job.name === "low-stock-alert") {
        const prisma = new PrismaClient();
        try {
          const threshold = (job.data?.threshold as number) ?? LOW_STOCK_THRESHOLD;
          const counts = await prisma.component.groupBy({
            by: ["categoryId"],
            where: { status: "IN_STOCK" },
            _count: { _all: true },
          });
          const low = counts.filter((c) => c._count._all < threshold);
          logger.log(
            `Low-stock categories (<${threshold}): ${low.map((c) => `${c.categoryId}=${c._count._all}`).join(", ")}`,
          );
          return { ok: true, lowCategories: low.length };
        } finally {
          await prisma.$disconnect();
        }
      }
      return { ok: false };
    },
    { connection: getRedisConnection() },
  );
}
