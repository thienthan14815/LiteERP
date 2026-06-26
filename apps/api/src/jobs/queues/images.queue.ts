import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { Queue, Worker } from "bullmq";
import { getRedisConnection } from "./redis-connection";

export const IMAGES_QUEUE = "images";

export interface ProcessImagePayload {
  attachmentId: string;
}

@Injectable()
export class ImagesQueueService implements OnModuleDestroy {
  private readonly queue: Queue;
  constructor() {
    this.queue = new Queue(IMAGES_QUEUE, { connection: getRedisConnection() });
  }
  async enqueueProcessImage(payload: ProcessImagePayload) {
    const job = await this.queue.add("process-image", payload, {
      removeOnComplete: 100,
      removeOnFail: 100,
    });
    return job.id;
  }
  async onModuleDestroy() {
    await this.queue.close();
  }
}

export function startImagesWorker() {
  const logger = new Logger("ImagesWorker");
  return new Worker<ProcessImagePayload>(
    IMAGES_QUEUE,
    async (job) => {
      logger.log(`Stub process-image for ${job.data.attachmentId}`);
      return { ok: true };
    },
    { connection: getRedisConnection() },
  );
}
