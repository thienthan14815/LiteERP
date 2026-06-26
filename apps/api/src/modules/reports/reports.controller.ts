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

    const [revenueAgg, machineByStatus, componentByStatus, awaitingInspection, inventoryValueRows] =
      await Promise.all([
        this.prisma.salesOrder.aggregate({
          where: { status: SalesOrderStatus.CONFIRMED, confirmedAt: { gte: monthStart } },
          _sum: { totalAmount: true },
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
    const inventoryValue = inventoryValueRows.reduce((s, r) => s + Number(r.costPrice), 0);

    return {
      revenueThisMonth: revenue,
      profitThisMonth: 0, // placeholder until cost-of-goods linkage is wired
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

  // Phase 2 will compute real revenue/cost/profit. Placeholder so the FE can wire up.
  @Get("reports/profit")
  @Permissions("report:view")
  profit(@Query() q: ProfitQueryDto) {
    return {
      revenue: 0,
      cost: 0,
      profit: 0,
      fromDate: q.fromDate ?? null,
      toDate: q.toDate ?? null,
    };
  }

  @Get("reports/inventory-value")
  @Permissions("report:view")
  inventoryValue() {
    return this.inventory.value();
  }
}
