import { Injectable } from "@nestjs/common";
import { DbService, DrizzleDb } from "../../database/db.service";
import { auditLogs } from "../../database/schema";
import { createId } from "../../database/id";
import { RequestContextService } from "../../common/context/request-context.service";

export interface AuditRecordInput {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditLogService {
  constructor(
    private readonly dbs: DbService,
    private readonly ctx: RequestContextService,
  ) {}

  // `db` is optional and only signals "I'm inside a transaction" at call
  // sites; routing into the open transaction is automatic (AsyncLocalStorage
  // in DbService), and the handle is the same shared drizzle instance.
  async record(input: AuditRecordInput, db?: DrizzleDb): Promise<void> {
    const client = db ?? this.dbs.db;
    const stored = this.ctx.get();
    await client.insert(auditLogs).values({
      id: createId(),
      actorUserId: input.actorId ?? stored?.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      // SQLite: audit JSON columns are TEXT. Serialize here; readers
      // JSON.parse when needed.
      beforeJson: input.before === undefined ? null : JSON.stringify(input.before),
      afterJson: input.after === undefined ? null : JSON.stringify(input.after),
      ip: input.ip ?? stored?.ip ?? null,
      userAgent: input.userAgent ?? stored?.userAgent ?? null,
    });
  }
}
