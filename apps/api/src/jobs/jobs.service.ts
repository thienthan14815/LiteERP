import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";
import { DbService } from "../database/db.service";
import { jobs } from "../database/schema";
import { createId } from "../database/id";

export type JobStatus = "queued" | "running" | "completed" | "failed";

// Durable job ledger backing the in-process queues. Because work runs in the
// same process (no external broker), a crash mid-run would otherwise leave a
// polled job "running" forever — reconcileOnBoot() fixes that on startup.
@Injectable()
export class JobsService implements OnModuleInit {
  private readonly logger = new Logger(JobsService.name);

  constructor(private readonly dbs: DbService) {}

  async onModuleInit(): Promise<void> {
    await this.reconcileOnBoot();
  }

  /** Any job still queued/running when the process last stopped was interrupted. */
  async reconcileOnBoot(): Promise<number> {
    try {
      const orphans = await this.dbs.db
        .select({ id: jobs.id })
        .from(jobs)
        .where(inArray(jobs.status, ["queued", "running"]));
      if (orphans.length === 0) return 0;
      await this.dbs.db
        .update(jobs)
        .set({
          status: "failed",
          error: "Interrupted by process shutdown",
          updatedAt: new Date(),
        })
        .where(inArray(jobs.status, ["queued", "running"]));
      this.logger.warn(`Reconciled ${orphans.length} interrupted job(s) → failed`);
      return orphans.length;
    } catch (err) {
      this.logger.error(`Job reconcile-on-boot failed: ${(err as Error).message}`);
      return 0;
    }
  }

  async create(type: string, payload: unknown): Promise<string> {
    const id = createId();
    await this.dbs.db.insert(jobs).values({
      id,
      type,
      status: "queued",
      payloadJson: payload === undefined ? null : JSON.stringify(payload),
    });
    return id;
  }

  async markRunning(id: string): Promise<void> {
    await this.setStatus(id, "running");
  }

  async markCompleted(id: string, result: unknown): Promise<void> {
    await this.dbs.db
      .update(jobs)
      .set({
        status: "completed",
        resultJson: result === undefined ? null : JSON.stringify(result),
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, id));
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.dbs.db
      .update(jobs)
      .set({ status: "failed", error, updatedAt: new Date() })
      .where(eq(jobs.id, id));
  }

  async get(id: string): Promise<{
    id: string;
    type: string;
    status: JobStatus;
    result: unknown;
    error: string | null;
  } | null> {
    const row = (await this.dbs.db.select().from(jobs).where(eq(jobs.id, id)).limit(1))[0];
    if (!row) return null;
    return {
      id: row.id,
      type: row.type,
      status: row.status as JobStatus,
      result: row.resultJson ? JSON.parse(row.resultJson) : null,
      error: row.error ?? null,
    };
  }

  private async setStatus(id: string, status: JobStatus): Promise<void> {
    await this.dbs.db
      .update(jobs)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(jobs.id, id)));
  }
}
