import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";

export interface GenerateReportPayload {
  reportType: string;
  params: Record<string, unknown>;
}

interface JobRecord {
  id: string;
  status: "active" | "completed" | "failed";
  returnValue?: unknown;
  failedReason: string | null;
}

const MAX_TRACKED_JOBS = 100;

// In-process replacement for the former BullMQ queue (Redis removed for the
// single-process / on-device deployment). Jobs run immediately; a bounded
// in-memory map preserves the status(id) contract used by ReportsController.
@Injectable()
export class ReportsQueueService {
  private readonly logger = new Logger(ReportsQueueService.name);
  private readonly jobs = new Map<string, JobRecord>();

  async enqueueGenerate(payload: GenerateReportPayload): Promise<string> {
    const id = randomUUID();
    const record: JobRecord = { id, status: "active", failedReason: null };
    this.jobs.set(id, record);
    if (this.jobs.size > MAX_TRACKED_JOBS) {
      const oldest = this.jobs.keys().next().value;
      if (oldest) this.jobs.delete(oldest);
    }
    setImmediate(() => {
      try {
        // Stub — matches the former worker behaviour.
        this.logger.log(`generate-report ${id} for ${payload.reportType}`);
        const csv = `report,${payload.reportType}\ngeneratedAt,${new Date().toISOString()}\n`;
        record.returnValue = {
          ok: true,
          fileName: `${payload.reportType}-${Date.now()}.csv`,
          bytes: csv.length,
        };
        record.status = "completed";
      } catch (err) {
        record.status = "failed";
        record.failedReason = err instanceof Error ? err.message : String(err);
        this.logger.error(`generate-report ${id} failed: ${record.failedReason}`);
      }
    });
    return id;
  }

  async status(id: string) {
    const job = this.jobs.get(id);
    if (!job) return { id, status: "not_found" };
    return {
      id,
      status: job.status,
      progress: job.status === "completed" ? 100 : 0,
      returnValue: job.returnValue,
      failedReason: job.failedReason,
    };
  }
}
