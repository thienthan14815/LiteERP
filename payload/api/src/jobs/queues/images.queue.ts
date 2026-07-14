import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";

export interface ProcessImagePayload {
  attachmentId: string;
}

// In-process replacement for the former BullMQ queue (Redis removed for the
// single-process / on-device deployment). Same public API as before.
@Injectable()
export class ImagesQueueService {
  private readonly logger = new Logger(ImagesQueueService.name);

  async enqueueProcessImage(payload: ProcessImagePayload) {
    const id = randomUUID();
    setImmediate(() => {
      // Stub — matches the former worker behaviour.
      this.logger.log(`process-image for ${payload.attachmentId}`);
    });
    return id;
  }
}
