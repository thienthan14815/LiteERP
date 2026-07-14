import { Controller, Get, Query } from "@nestjs/common";
import { and, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { DbService } from "../../database/db.service";
import { auditLogs } from "../../database/schema";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { buildPagination, paginate } from "../../common/utils/pagination.util";
import { QueryAuditLogsDto } from "./dto/query-audit-logs.dto";

@Controller("audit-logs")
export class AuditLogsController {
  constructor(private readonly dbs: DbService) {}

  @Get()
  @Permissions("audit:view")
  async list(@Query() q: QueryAuditLogsDto) {
    const conds: SQL[] = [];
    if (q.entityType) conds.push(eq(auditLogs.entityType, q.entityType));
    if (q.entityId) conds.push(eq(auditLogs.entityId, q.entityId));
    if (q.actorId) conds.push(eq(auditLogs.actorUserId, q.actorId));
    if (q.action) conds.push(eq(auditLogs.action, q.action));
    if (q.fromDate) conds.push(gte(auditLogs.createdAt, new Date(q.fromDate)));
    if (q.toDate) conds.push(lte(auditLogs.createdAt, new Date(q.toDate)));
    const where = conds.length ? and(...conds) : undefined;

    const { take, skip } = buildPagination(q.page, q.pageSize);
    const db = this.dbs.db;
    const items = await db
      .select()
      .from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(take)
      .offset(skip);
    const totalRows = await db
      .select({ count: sql<number>`count(*)`.as("count") })
      .from(auditLogs)
      .where(where);
    const total = Number(totalRows[0]?.count ?? 0);
    return paginate(items, total, q.page ?? 1, q.pageSize ?? 20);
  }
}
