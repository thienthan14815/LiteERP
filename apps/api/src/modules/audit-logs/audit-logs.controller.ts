import { Controller, Get, Query } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { buildPagination, paginate } from "../../common/utils/pagination.util";
import { QueryAuditLogsDto } from "./dto/query-audit-logs.dto";

@Controller("audit-logs")
export class AuditLogsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Permissions("audit:view")
  async list(@Query() q: QueryAuditLogsDto) {
    const where: Prisma.AuditLogWhereInput = {};
    if (q.entityType) where.entityType = q.entityType;
    if (q.entityId) where.entityId = q.entityId;
    if (q.actorId) where.actorUserId = q.actorId;
    if (q.action) where.action = q.action;
    if (q.fromDate || q.toDate) {
      where.createdAt = {};
      if (q.fromDate) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(q.fromDate);
      if (q.toDate) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(q.toDate);
    }
    const { take, skip } = buildPagination(q.page, q.pageSize);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginate(items, total, q.page ?? 1, q.pageSize ?? 20);
  }
}
