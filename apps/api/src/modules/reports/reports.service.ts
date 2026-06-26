import { Injectable } from "@nestjs/common";
import {
  ComponentStatus,
  Prisma,
  SalesItemType,
  SalesOrderStatus,
} from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";

export interface DateRangeQuery {
  fromDate?: string;
  toDate?: string;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private range(q: DateRangeQuery): { from: Date; to: Date } {
    const from = q.fromDate ? new Date(q.fromDate) : firstDayOfMonth();
    const to = q.toDate ? endOfDay(new Date(q.toDate)) : new Date();
    return { from, to };
  }

  async profit(q: DateRangeQuery) {
    const { from, to } = this.range(q);
    const items = await this.prisma.salesItem.findMany({
      where: {
        salesOrder: {
          status: SalesOrderStatus.CONFIRMED,
          confirmedAt: { gte: from, lte: to },
        },
      },
      select: {
        unitPrice: true,
        unitCost: true,
        quantity: true,
        salesOrder: { select: { confirmedAt: true } },
      },
    });
    const orders = await this.prisma.salesOrder.count({
      where: {
        status: SalesOrderStatus.CONFIRMED,
        confirmedAt: { gte: from, lte: to },
      },
    });
    const revenue = items.reduce((s, it) => s + Number(it.unitPrice) * it.quantity, 0);
    const cost = items.reduce((s, it) => s + Number(it.unitCost) * it.quantity, 0);

    const dailyMap = new Map<string, { revenue: number; cost: number }>();
    for (const it of items) {
      const ts = it.salesOrder?.confirmedAt;
      if (!ts) continue;
      const key = ts.toISOString().slice(0, 10);
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
    const rows = await this.prisma.component.findMany({
      where: { status: ComponentStatus.IN_STOCK },
      select: {
        costPrice: true,
        category: { select: { code: true, name: true } },
      },
    });
    const byCategory = new Map<string, { category: string; name: string; value: number; count: number }>();
    let totalValue = 0;
    for (const r of rows) {
      const v = Number(r.costPrice);
      totalValue += v;
      const cur = byCategory.get(r.category.code) ?? {
        category: r.category.code,
        name: r.category.name,
        value: 0,
        count: 0,
      };
      cur.value += v;
      cur.count += 1;
      byCategory.set(r.category.code, cur);
    }
    const all = Array.from(byCategory.values()).sort((a, b) => b.value - a.value);
    return {
      totalValue,
      totalCount: rows.length,
      byCategory: all,
      topCategories: all.slice(0, 5),
    };
  }

  async salesByProduct(q: DateRangeQuery) {
    const { from, to } = this.range(q);
    const items = await this.prisma.salesItem.findMany({
      where: {
        salesOrder: {
          status: SalesOrderStatus.CONFIRMED,
          confirmedAt: { gte: from, lte: to },
        },
      },
      select: {
        itemType: true,
        unitPrice: true,
        unitCost: true,
        quantity: true,
        finishedPc: { select: { id: true } },
        component: { select: { category: { select: { code: true, name: true } } } },
      },
    });
    const buckets = new Map<string, { itemType: SalesItemType; name: string; qty: number; revenue: number; cost: number }>();
    for (const it of items) {
      let key: string;
      let name: string;
      if (it.itemType === SalesItemType.FINISHED_PC) {
        key = "FINISHED_PC";
        name = "Máy thành phẩm";
      } else {
        const code = it.component?.category.code ?? "OTHER";
        key = `COMPONENT:${code}`;
        name = it.component?.category.name ?? code;
      }
      const cur = buckets.get(key) ?? { itemType: it.itemType, name, qty: 0, revenue: 0, cost: 0 };
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
    const orders = await this.prisma.salesOrder.findMany({
      where: {
        status: SalesOrderStatus.CONFIRMED,
        confirmedAt: { gte: from, lte: to },
        customerId: { not: null },
      },
      select: {
        customerId: true,
        customer: { select: { id: true, code: true, name: true, phone: true } },
        items: { select: { unitPrice: true, unitCost: true, quantity: true } },
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
    const rows = await this.prisma.component.findMany({
      where: { status: ComponentStatus.IN_STOCK, createdAt: { lte: cutoff } },
      select: {
        id: true,
        code: true,
        createdAt: true,
        costPrice: true,
        category: { select: { code: true, name: true } },
      },
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
