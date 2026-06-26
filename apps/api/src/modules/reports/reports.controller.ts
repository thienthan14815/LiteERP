import { Controller, Get, Query } from "@nestjs/common";
import { IsISO8601, IsOptional } from "class-validator";
import { ComponentStatus, MachineStatus, SalesOrderStatus } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import { Permissions } from "../../common/decorators/permissions.decorator";

class ProfitQueryDto {
  @IsOptional() @IsISO8601() fromDate?: string;
  @IsOptional() @IsISO8601() toDate?: string;
}

@Controller()
export class ReportsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  // TODO(phase-3): cache this aggregate behind Redis (60s TTL per ARCHITECTURE
  // section 15/26). Computed live for now.
  @Get("dashboard")
  @Permissions("dashboard:view")
  async dashboard() {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [
      revenueAgg,
      salesItemsThisMonth,
      machineByStatus,
      componentByStatus,
      awaitingInspection,
      inventoryValueRows,
    ] = await Promise.all([
      this.prisma.salesOrder.aggregate({
        where: { status: SalesOrderStatus.CONFIRMED, confirmedAt: { gte: monthStart } },
        _sum: { totalAmount: true },
      }),
      this.prisma.salesItem.findMany({
        where: {
          salesOrder: {
            status: SalesOrderStatus.CONFIRMED,
            confirmedAt: { gte: monthStart },
          },
        },
        select: { unitPrice: true, unitCost: true, quantity: true },
      }),
      this.prisma.machine.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      this.prisma.component.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      this.prisma.machine.count({ where: { status: MachineStatus.NEW } }),
      this.prisma.component.findMany({
        where: { status: ComponentStatus.IN_STOCK },
        select: { costPrice: true },
      }),
    ]);

    const revenue = Number(revenueAgg._sum.totalAmount ?? 0);
    const revenueFromItems = salesItemsThisMonth.reduce(
      (s, it) => s + Number(it.unitPrice) * it.quantity,
      0,
    );
    const costFromItems = salesItemsThisMonth.reduce(
      (s, it) => s + Number(it.unitCost) * it.quantity,
      0,
    );
    const profit = revenueFromItems - costFromItems;
    const inventoryValue = inventoryValueRows.reduce((s, r) => s + Number(r.costPrice), 0);

    return {
      revenueThisMonth: revenue,
      profitThisMonth: profit,
      inventoryValue,
      machinesByStatus: Object.fromEntries(
        machineByStatus.map((g) => [g.status, g._count._all]),
      ),
      componentsByStatus: Object.fromEntries(
        componentByStatus.map((g) => [g.status, g._count._all]),
      ),
      machinesAwaitingInspection: awaitingInspection,
      openWarrantyCases: 0,
    };
  }

  @Get("reports/profit")
  @Permissions("report:view")
  async profit(@Query() q: ProfitQueryDto) {
    const from = q.fromDate ? new Date(q.fromDate) : firstDayOfMonth();
    const to = q.toDate ? new Date(q.toDate) : new Date();

    const [orders, items] = await Promise.all([
      this.prisma.salesOrder.findMany({
        where: {
          status: SalesOrderStatus.CONFIRMED,
          confirmedAt: { gte: from, lte: to },
        },
        select: { id: true },
      }),
      this.prisma.salesItem.findMany({
        where: {
          salesOrder: {
            status: SalesOrderStatus.CONFIRMED,
            confirmedAt: { gte: from, lte: to },
          },
        },
        select: { unitPrice: true, unitCost: true, quantity: true },
      }),
    ]);

    const revenue = items.reduce((s, it) => s + Number(it.unitPrice) * it.quantity, 0);
    const cost = items.reduce((s, it) => s + Number(it.unitCost) * it.quantity, 0);
    const profit = revenue - cost;

    return {
      revenue,
      cost,
      profit,
      salesCount: orders.length,
      fromDate: from.toISOString(),
      toDate: to.toISOString(),
    };
  }

  @Get("reports/inventory-value")
  @Permissions("report:view")
  inventoryValue() {
    return this.inventory.value();
  }
}

function firstDayOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}
