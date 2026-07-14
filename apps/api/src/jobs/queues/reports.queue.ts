import { Injectable, Logger } from "@nestjs/common";
import { JobsService } from "../jobs.service";

export interface GenerateReportPayload {
  reportType: string;
  params: Record<string, unknown>;
}

// In-process replacement for the former BullMQ queue (Redis removed for the
// single-process / on-device deployment). Job state is now persisted in the
// `jobs` table via JobsService, so a status(id) poll survives a restart and a
// job interrupted by a crash is reconciled to "failed" on boot (no stuck
// "running").
@Injectable()
export class ReportsQueueService {
  private readonly logger = new Logger(ReportsQueueService.name);

  constructor(private readonly jobsSvc: JobsService) {}

  async enqueueGenerate(payload: GenerateReportPayload): Promise<string> {
    const id = await this.jobsSvc.create("generate-report", payload);
    setImmediate(async () => {
      try {
        await this.jobsSvc.markRunning(id);
        // Stub work — matches the former worker behaviour.
        this.logger.log(`generate-report ${id} for ${payload.reportType}`);
        const csv = `report,${payload.reportType}\ngeneratedAt,${new Date().toISOString()}\n`;
        await this.jobsSvc.markCompleted(id, {
          ok: true,
          fileName: `${payload.reportType}-${Date.now()}.csv`,
          bytes: csv.length,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`generate-report ${id} failed: ${msg}`);
        await this.jobsSvc.markFailed(id, msg);
      }
    });
    return id;
  }

  async status(id: string) {
    const job = await this.jobsSvc.get(id);
    if (!job) return { id, status: "not_found" };
    return {
      id,
      status: job.status,
      progress: job.status === "completed" ? 100 : 0,
      returnValue: job.result,
      failedReason: job.error,
    };
  }
}
