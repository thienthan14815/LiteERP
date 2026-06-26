import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { Queue, QueueEvents, Worker } from "bullmq";
import { getRedisConnection } from "./redis-connection";

export const REPORTS_QUEUE = "reports";

export interface GenerateReportPayload {
  reportType: string;
  params: Record<string, unknown>;
}

@Injectable()
export class ReportsQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(ReportsQueueService.name);
  private readonly queue: Queue;
  private readonly events: QueueEvents;

  constructor() {
    const connection = getRedisConnection();
    this.queue = new Queue(REPORTS_QUEUE, { connection });
    this.events = new QueueEvents(REPORTS_QUEUE, { connection });
  }

  async enqueueGenerate(payload: GenerateReportPayload): Promise<string> {
    const job = await this.queue.add("generate-report", payload, {
      removeOnComplete: 100,
      removeOnFail: 100,
    });
    return job.id ?? "";
  }

  async status(id: string) {
    const job = await this.queue.getJob(id);
    if (!job) return { id, status: "not_found" };
    const state = await job.getState();
    return {
      id,
      status: state,
      progress: job.progress,
      returnValue: job.returnvalue,
      failedReason: job.failedReason ?? null,
    };
  }

  async onModuleDestroy() {
    await this.queue.close();
    await this.events.close();
  }
}

export function startReportsWorker() {
  const logger = new Logger("ReportsWorker");
  return new Worker<GenerateReportPayload>(
    REPORTS_QUEUE,
    async (job) => {
      logger.log(`Stub generate-report ${job.id} for ${job.data.reportType}`);
      const csv = `report,${job.data.reportType}\ngeneratedAt,${new Date().toISOString()}\n`;
      return {
        ok: true,
        fileName: `${job.data.reportType}-${Date.now()}.csv`,
        bytes: csv.length,
      };
    },
    { connection: getRedisConnection() },
  );
}
