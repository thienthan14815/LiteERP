import { Injectable } from "@nestjs/common";
import { ComponentStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { StockTransactionService } from "./stock-transaction.service";
import { AuditLogService } from "../audit-logs/audit-logs.service";
import { buildPagination, paginate } from "../../common/utils/pagination.util";
import { QueryStockDto } from "./dto/query-stock.dto";
import { AdjustmentDto } from "./dto/adjustment.dto";

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockTransactionService,
    private readonly audit: AuditLogService,
  ) {}

  async listTransactions(q: QueryStockDto) {
    const where: Prisma.StockTransactionWhereInput = {};
    if (q.type) where.type = q.type;
    if (q.componentId) where.componentId = q.componentId;
    if (q.refType) where.refType = q.refType;
    if (q.refId) where.refId = q.refId;
    if (q.fromDate || q.toDate) {
      where.createdAt = {};
      if (q.fromDate) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(q.fromDate);
      if (q.toDate) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(q.toDate);
    }
    const { take, skip } = buildPagination(q.page, q.pageSize);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.stockTransaction.findMany({
        where,
        include: { component: { select: { code: true, categoryId: true } } },
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      this.prisma.stockTransaction.count({ where }),
    ]);
    return paginate(items, total, q.page ?? 1, q.pageSize ?? 20);
  }

  async summary() {
    const byStatus = await this.prisma.component.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    const byCategory = await this.prisma.component.groupBy({
      by: ["categoryId"],
      _count: { _all: true },
    });
    const machineByStatus = await this.prisma.machine.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    const finishedByStatus = await this.prisma.finishedPc.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    return {
      components: {
        byStatus: Object.fromEntries(byStatus.map((g) => [g.status, g._count._all])),
        byCategory: Object.fromEntries(byCategory.map((g) => [g.categoryId, g._count._all])),
      },
      machines: Object.fromEntries(machineByStatus.map((g) => [g.status, g._count._all])),
      finishedPcs: Object.fromEntries(finishedByStatus.map((g) => [g.status, g._count._all])),
    };
  }

  async value() {
    const rows = await this.prisma.component.findMany({
      where: { status: ComponentStatus.IN_STOCK },
      select: { categoryId: true, costPrice: true, category: { select: { code: true, name: true } } },
    });
    const byCategory = new Map<string, { code: string; name: string; total: number; count: number }>();
    let total = 0;
    for (const r of rows) {
      const cost = Number(r.costPrice);
      total += cost;
      const entry = byCategory.get(r.categoryId) ?? {
        code: r.category.code,
        name: r.category.name,
        total: 0,
        count: 0,
      };
      entry.total += cost;
      entry.count += 1;
      byCategory.set(r.categoryId, entry);
    }
    return {
      totalValue: total,
      totalCount: rows.length,
      byCategory: Array.from(byCategory.values()),
    };
  }

  async adjust(dto: AdjustmentDto) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.component.findUnique({ where: { id: dto.componentId } });
      const txn = await this.stock.create(
        {
          componentId: dto.componentId,
          type: dto.type,
          reason: dto.reason,
          notes: dto.notes,
          newComponentStatus: dto.newStatus,
          refType: "ADJUSTMENT",
        },
        tx,
      );
      const after = dto.newStatus
        ? await tx.component.findUnique({ where: { id: dto.componentId } })
        : before;
      await this.audit.record(
        {
          action: "inventory.adjust",
          entityType: "Component",
          entityId: dto.componentId,
          before,
          after,
        },
        tx,
      );
      return txn;
    });
  }
}
