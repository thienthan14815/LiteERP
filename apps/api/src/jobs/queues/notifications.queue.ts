import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { Queue, Worker } from "bullmq";
import { getRedisConnection } from "./redis-connection";

export const NOTIFICATIONS_QUEUE = "notifications";

export interface WarrantyNotificationPayload {
  warrantyCaseId: string;
  status: string;
  customerId: string;
}

@Injectable()
export class NotificationsQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(NotificationsQueueService.name);
  private readonly queue: Queue;

  constructor() {
    this.queue = new Queue(NOTIFICATIONS_QUEUE, { connection: getRedisConnection() });
  }

  async enqueueWarrantyStatus(payload: WarrantyNotificationPayload) {
    const job = await this.queue.add("warranty-status", payload, {
      removeOnComplete: 100,
      removeOnFail: 100,
    });
    return job.id;
  }

  async onModuleDestroy() {
    await this.queue.close();
  }
}

export function startNotificationsWorker() {
  const logger = new Logger("NotificationsWorker");
  return new Worker(
    NOTIFICATIONS_QUEUE,
    async (job) => {
      logger.log(`Stub send notification for ${job.name}: ${JSON.stringify(job.data)}`);
      return { ok: true };
    },
    { connection: getRedisConnection() },
  );
}
