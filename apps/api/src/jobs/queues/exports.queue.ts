import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { Queue, Worker } from "bullmq";
import { getRedisConnection } from "./redis-connection";

export const EXPORTS_QUEUE = "exports";

export interface ExportExcelPayload {
  entity: string;
  filters?: Record<string, unknown>;
}

@Injectable()
export class ExportsQueueService implements OnModuleDestroy {
  private readonly queue: Queue;
  constructor() {
    this.queue = new Queue(EXPORTS_QUEUE, { connection: getRedisConnection() });
  }
  async enqueueExportExcel(payload: ExportExcelPayload) {
    const job = await this.queue.add("export-excel", payload, {
      removeOnComplete: 100,
      removeOnFail: 100,
    });
    return job.id;
  }
  async onModuleDestroy() {
    await this.queue.close();
  }
}

export function startExportsWorker() {
  const logger = new Logger("ExportsWorker");
  return new Worker<ExportExcelPayload>(
    EXPORTS_QUEUE,
    async (job) => {
      logger.log(`Stub export-excel ${job.id} for ${job.data.entity}`);
      return { ok: true };
    },
    { connection: getRedisConnection() },
  );
}
