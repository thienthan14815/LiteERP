import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";

export interface ExportExcelPayload {
  entity: string;
  filters?: Record<string, unknown>;
}

// In-process replacement for the former BullMQ queue (Redis removed for the
// single-process / on-device deployment). Same public API as before.
@Injectable()
export class ExportsQueueService {
  private readonly logger = new Logger(ExportsQueueService.name);

  async enqueueExportExcel(payload: ExportExcelPayload) {
    const id = randomUUID();
    setImmediate(() => {
      // Stub — matches the former worker behaviour.
      this.logger.log(`export-excel ${id} for ${payload.entity}`);
    });
    return id;
  }
}
