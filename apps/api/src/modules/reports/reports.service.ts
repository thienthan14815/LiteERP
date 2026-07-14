import { Injectable } from "@nestjs/common";
import { and, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { ComponentStatus, SalesItemType, SalesOrderStatus } from "@app/shared";
import { DbService } from "../../database/db.service";
import { computeStockValue } from "../../common/utils/stock-value.util";
import {
  componentCategories,
  components,
  salesItems,
  salesOrders,
} from "../../database/schema";

export interface DateRangeQuery {
  fromDate?: string;
  toDate?: string;
}

@Injectable()
export class ReportsService {
  constructor(private readonly dbs: DbService) {}

  private range(q: DateRangeQuery): { from: Date; to: Date } {
    const from = q.fromDate ? new Date(q.fromDate) : firstDayOfMonth();
    const to = q.toDate ? endOfDay(new Date(q.toDate)) : new Date();
    return { from, to };
  }

  /** Sales orders CONFIRMED within [from, to] — shared revenue-report filter. */
  private confirmedOrdersFilter(from: Date, to: Date) {
    return and(
      eq(salesOrders.status, SalesOrderStatus.CONFIRMED),
      gte(salesOrders.confirmedAt, from),
      lte(salesOrders.confirmedAt, to),
    );
  }

  async profit(q: DateRangeQuery) {
    const { from, to } = this.range(q);
    const db = this.dbs.db;
    const items = await db
      .select({
        unitPrice: salesItems.unitPrice,
        unitCost: salesItems.unitCost,
        quantity: salesItems.quantity,
        confirmedAt: salesOrders.confirmedAt,
      })
      .from(salesItems)
      .innerJoin(salesOrders, eq(salesItems.salesOrderId, salesOrders.id))
      .where(this.confirmedOrdersFilter(from, to));
    const orderRows = await db
      .select({ count: sql<number>`count(*)`.as("count") })
      .from(salesOrders)
      .where(this.confirmedOrdersFilter(from, to));
    const orders = Number(orderRows[0]?.count ?? 0);
    const revenue = items.reduce((s, it) => s + Number(it.unitPrice) * it.quantity, 0);
    const cost = items.reduce((s, it) => s + Number(it.unitCost) * it.quantity, 0);

    const dailyMap = new Map<string, { revenue: number; cost: number }>();
    for (const it of items) {
      const ts = it.confirmedAt;
      if (!ts) continue;
      const key = new Date(ts).toISOString().slice(0, 10);
      const cur = dailyMap.get(key) ?? { revenue: 0, cost: 0 };
      cur.revenue += Number(it.unitPrice) * it.quantity;
      cur.cost += Number(it.unitCost) * it.quantity;
      dailyMap.set(key, cur);
    }
    const dailyBreakdown = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, revenue: v.revenue, cost: v.cost, profit: v.revenue - v.cost }));

    return {
      revenue,
      cost,
      profit: revenue - cost,
      salesCount: orders,
      fromDate: from.toISOString(),
      toDate: to.toISOString(),
      dailyBreakdown,
    };
  }

  async inventoryValue() {
    // Giá trị tồn kho = linh kiện + máy cũ + PC thành phẩm chưa bán
    // (định nghĩa & chống đếm trùng: xem stock-value.util).
    const sv = await computeStockValue(this.dbs.db);
    return {
      totalValue: sv.totalValue,
      totalCount: sv.totalCount,
      byCategory: sv.byCategory,
      topCategories: sv.byCategory.slice(0, 5),
      breakdown: {
        components: sv.components,
        machines: sv.machines,
        finishedPcs: sv.finishedPcs,
      },
    };
  }

  async salesByProduct(q: DateRangeQuery) {
    const { from, to } = this.range(q);
    const items = await this.dbs.db
      .select({
        itemType: salesItems.itemType,
        unitPrice: salesItems.unitPrice,
        unitCost: salesItems.unitCost,
        quantity: salesItems.quantity,
        categoryCode: componentCategories.code,
        categoryName: componentCategories.name,
      })
      .from(salesItems)
      .innerJoin(salesOrders, eq(salesItems.salesOrderId, salesOrders.id))
      .leftJoin(components, eq(salesItems.componentId, components.id))
      .leftJoin(componentCategories, eq(components.categoryId, componentCategories.id))
      .where(this.confirmedOrdersFilter(from, to));
    const buckets = new Map<string, { itemType: SalesItemType; name: string; qty: number; revenue: number; cost: number }>();
    for (const it of items) {
      let key: string;
      let name: string;
      if (it.itemType === SalesItemType.FINISHED_PC) {
        key = "FINISHED_PC";
        name = "Máy thành phẩm";
      } else {
        const code = it.categoryCode ?? "OTHER";
        key = `COMPONENT:${code}`;
        name = it.categoryName ?? code;
      }
      const cur = buckets.get(key) ?? {
        itemType: it.itemType as SalesItemType,
        name,
        qty: 0,
        revenue: 0,
        cost: 0,
      };
      cur.qty += it.quantity;
      cur.revenue += Number(it.unitPrice) * it.quantity;
      cur.cost += Number(it.unitCost) * it.quantity;
      buckets.set(key, cur);
    }
    return Array.from(buckets.values())
      .map((b) => ({ ...b, profit: b.revenue - b.cost }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  async topCustomers(q: DateRangeQuery & { limit?: number }) {
    const { from, to } = this.range(q);
    const limit = Math.max(1, Math.min(q.limit ?? 10, 100));
    const orders = await this.dbs.db.query.salesOrders.findMany({
      where: and(this.confirmedOrdersFilter(from, to), isNotNull(salesOrders.customerId)),
      columns: { customerId: true },
      with: {
        customer: { columns: { id: true, code: true, name: true, phone: true } },
        items: { columns: { unitPrice: true, unitCost: true, quantity: true } },
      },
    });
    const buckets = new Map<string, {
      customerId: string;
      code: string;
      name: string;
      phone: string | null;
      revenue: number;
      cost: number;
      orderCount: number;
    }>();
    for (const o of orders) {
      if (!o.customer) continue;
      const cur = buckets.get(o.customer.id) ?? {
        customerId: o.customer.id,
        code: o.customer.code,
        name: o.customer.name,
        phone: o.customer.phone,
        revenue: 0,
        cost: 0,
        orderCount: 0,
      };
      for (const it of o.items) {
        cur.revenue += Number(it.unitPrice) * it.quantity;
        cur.cost += Number(it.unitCost) * it.quantity;
      }
      cur.orderCount += 1;
      buckets.set(o.customer.id, cur);
    }
    return Array.from(buckets.values())
      .map((b) => ({ ...b, profit: b.revenue - b.cost }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  }

  async inventoryAging(days = 30) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await this.dbs.db.query.components.findMany({
      where: and(
        eq(components.status, ComponentStatus.IN_STOCK),
        lte(components.createdAt, cutoff),
      ),
      columns: { id: true, code: true, createdAt: true, costPrice: true },
      with: { category: { columns: { code: true, name: true } } },
    });
    const buckets = new Map<string, { category: string; name: string; count: number; value: number }>();
    for (const r of rows) {
      const cur = buckets.get(r.category.code) ?? {
        category: r.category.code,
        name: r.category.name,
        count: 0,
        value: 0,
      };
      cur.count += 1;
      cur.value += Number(r.costPrice);
      buckets.set(r.category.code, cur);
    }
    return {
      thresholdDays: days,
      totalAging: rows.length,
      byCategory: Array.from(buckets.values()).sort((a, b) => b.count - a.count),
    };
  }
}

function firstDayOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(d: Date): Date {
  d.setHours(23, 59, 59, 999);
  return d;
}
