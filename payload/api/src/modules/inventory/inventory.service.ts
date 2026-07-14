import { Injectable } from "@nestjs/common";
import { and, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { ComponentStatus } from "@app/shared";
import { DbService } from "../../database/db.service";
import {
  componentCategories,
  components,
  finishedPcs,
  machines,
  stockTransactions,
} from "../../database/schema";
import { StockTransactionService } from "./stock-transaction.service";
import { AuditLogService } from "../audit-logs/audit-logs.service";
import { buildPagination, paginate } from "../../common/utils/pagination.util";
import { QueryStockDto } from "./dto/query-stock.dto";
import { AdjustmentDto } from "./dto/adjustment.dto";

@Injectable()
export class InventoryService {
  constructor(
    private readonly dbs: DbService,
    private readonly stock: StockTransactionService,
    private readonly audit: AuditLogService,
  ) {}

  async listTransactions(q: QueryStockDto) {
    const db = this.dbs.db;
    const conds: SQL[] = [];
    if (q.type) conds.push(eq(stockTransactions.type, q.type));
    if (q.componentId) conds.push(eq(stockTransactions.componentId, q.componentId));
    if (q.refType) conds.push(eq(stockTransactions.refType, q.refType));
    if (q.refId) conds.push(eq(stockTransactions.refId, q.refId));
    if (q.fromDate) conds.push(gte(stockTransactions.createdAt, new Date(q.fromDate)));
    if (q.toDate) conds.push(lte(stockTransactions.createdAt, new Date(q.toDate)));
    const where = conds.length ? and(...conds) : undefined;
    const { take, skip } = buildPagination(q.page, q.pageSize);
    const items = await db.query.stockTransactions.findMany({
      where,
      with: { component: { columns: { code: true, categoryId: true } } },
      orderBy: [desc(stockTransactions.createdAt)],
      limit: take,
      offset: skip,
    });
    const totalRows = await db
      .select({ count: sql<number>`count(*)`.as("count") })
      .from(stockTransactions)
      .where(where);
    const total = Number(totalRows[0]?.count ?? 0);
    return paginate(items, total, q.page ?? 1, q.pageSize ?? 20);
  }

  async summary() {
    const db = this.dbs.db;
    const byStatusRaw = await db
      .select({ status: components.status, count: sql<number>`count(*)`.as("count") })
      .from(components)
      .groupBy(components.status);
    const byCategoryRaw = await db
      .select({ categoryId: components.categoryId, count: sql<number>`count(*)`.as("count") })
      .from(components)
      .groupBy(components.categoryId);
    // Map categoryId -> categoryCode để client hiển thị nhãn đúng.
    const categories = await db
      .select({ id: componentCategories.id, code: componentCategories.code })
      .from(componentCategories);
    const idToCode = new Map(categories.map((c) => [c.id, c.code]));
    const machineByStatus = await db
      .select({ status: machines.status, count: sql<number>`count(*)`.as("count") })
      .from(machines)
      .groupBy(machines.status);
    const finishedByStatus = await db
      .select({ status: finishedPcs.status, count: sql<number>`count(*)`.as("count") })
      .from(finishedPcs)
      .groupBy(finishedPcs.status);
    return {
      // Shape phẳng khớp UI /components/summary (mảng object).
      byStatus: byStatusRaw.map((g) => ({ status: g.status, count: Number(g.count) })),
      byCategory: byCategoryRaw
        .map((g) => ({ category: idToCode.get(g.categoryId) ?? "OTHER", count: Number(g.count) }))
        .filter((g) => g.count > 0),
      // Extra data cho các consumer khác (dashboard, mobile).
      machines: Object.fromEntries(machineByStatus.map((g) => [g.status, Number(g.count)])),
      finishedPcs: Object.fromEntries(finishedByStatus.map((g) => [g.status, Number(g.count)])),
    };
  }

  async value() {
    const rows = await this.dbs.db.query.components.findMany({
      where: eq(components.status, ComponentStatus.IN_STOCK),
      columns: { categoryId: true, costPrice: true },
      with: { category: { columns: { code: true, name: true } } },
    });
    const byCategory = new Map<string, { category: string; name: string; value: number; count: number }>();
    let total = 0;
    for (const r of rows) {
      const cost = Number(r.costPrice);
      total += cost;
      const entry = byCategory.get(r.categoryId) ?? {
        category: r.category.code,
        name: r.category.name,
        value: 0,
        count: 0,
      };
      entry.value += cost;
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
    return this.dbs.transaction(async (db) => {
      const beforeRows = await db
        .select()
        .from(components)
        .where(eq(components.id, dto.componentId))
        .limit(1);
      const before = beforeRows[0] ?? null;
      const txn = await this.stock.create(
        {
          componentId: dto.componentId,
          type: dto.type,
          reason: dto.reason,
          notes: dto.notes,
          newComponentStatus: dto.newStatus,
          refType: "ADJUSTMENT",
        },
        db,
      );
      const after = dto.newStatus
        ? ((
            await db.select().from(components).where(eq(components.id, dto.componentId)).limit(1)
          )[0] ?? null)
        : before;
      await this.audit.record(
        {
          action: "inventory.adjust",
          entityType: "Component",
          entityId: dto.componentId,
          before,
          after,
        },
        db,
      );
      return txn;
    });
  }
}
