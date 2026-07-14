import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";

export interface WarrantyNotificationPayload {
  warrantyCaseId: string;
  status: string;
  customerId: string;
}

// In-process replacement for the former BullMQ queue (Redis removed for the
// single-process / on-device deployment). Same public API as before.
@Injectable()
export class NotificationsQueueService {
  private readonly logger = new Logger(NotificationsQueueService.name);

  async enqueueWarrantyStatus(payload: WarrantyNotificationPayload) {
    const id = randomUUID();
    setImmediate(() => {
      // Stub — matches the former worker behaviour (no real channel yet).
      this.logger.log(`warranty-status notification: ${JSON.stringify(payload)}`);
    });
    return id;
  }
}
