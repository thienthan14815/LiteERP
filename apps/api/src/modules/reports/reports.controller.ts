import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsInt, IsISO8601, IsOptional, IsString, Max, Min } from "class-validator";
import {
  ComponentStatus,
  FinishedPcStatus,
  MachineStatus,
  SalesOrderStatus,
  WarrantyStatus,
} from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { ReportsService } from "./reports.service";
import { ReportsQueueService } from "../../jobs/queues/reports.queue";

class DateRangeDto {
  @IsOptional() @IsISO8601() fromDate?: string;
  @IsOptional() @IsISO8601() toDate?: string;
}

class TopCustomersDto extends DateRangeDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

class InventoryAgingDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(365) days?: number;
}

class ExportReportDto {
  @IsString() reportType!: string;
  @IsOptional() params?: Record<string, unknown>;
}

const DEFECTIVE_AGE_DAYS = 30;
const AGING_THRESHOLD_DAYS = 30;
const LOW_STOCK_CATEGORY_THRESHOLD = 3;

@Controller()
export class ReportsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
    private readonly reportsQueue: ReportsQueueService,
  ) {}

  @Get("dashboard")
  @Permissions("dashboard:view")
  async dashboard() {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const defectiveCutoff = new Date(Date.now() - DEFECTIVE_AGE_DAYS * 24 * 60 * 60 * 1000);
    const agingCutoff = new Date(Date.now() - AGING_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);

    const [
      salesItemsThisMonth,
      machineByStatus,
      componentByStatus,
      awaitingInspection,
      machinesCheckedAwaitingTest,
      inventoryValueRows,
      openWarranty,
      defectiveOldComponents,
      agingByCategory,
    ] = await Promise.all([
      this.prisma.salesItem.findMany({
        where: {
          salesOrder: {
            status: SalesOrderStatus.CONFIRMED,
            confirmedAt: { gte: monthStart },
          },
        },
        select: { unitPrice: true, unitCost: true, quantity: true },
      }),
      this.prisma.machine.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.component.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.machine.count({ where: { status: MachineStatus.NEW } }),
      this.prisma.machine.count({ where: { status: MachineStatus.CHECKED } }),
      this.prisma.component.findMany({
        where: { status: ComponentStatus.IN_STOCK },
        select: { costPrice: true },
      }),
      this.prisma.warrantyCase.count({
        where: {
          status: {
            in: [
              WarrantyStatus.RECEIVED,
              WarrantyStatus.INSPECTING,
              WarrantyStatus.REPAIRING,
              WarrantyStatus.REPLACED,
            ],
          },
        },
      }),
      this.prisma.component.count({
        where: { status: ComponentStatus.DEFECTIVE, updatedAt: { lte: defectiveCutoff } },
      }),
      this.prisma.component.groupBy({
        by: ["categoryId"],
        where: { status: ComponentStatus.IN_STOCK },
        _count: { _all: true },
      }),
    ]);

    const revenue = salesItemsThisMonth.reduce(
      (s, it) => s + Number(it.unitPrice) * it.quantity,
      0,
    );
    const costFromItems = salesItemsThisMonth.reduce(
      (s, it) => s + Number(it.unitCost) * it.quantity,
      0,
    );
    const profit = revenue - costFromItems;
    const inventoryValue = inventoryValueRows.reduce((s, r) => s + Number(r.costPrice), 0);

    const lowStockCategories = agingByCategory.filter(
      (g) => g._count._all < LOW_STOCK_CATEGORY_THRESHOLD,
    ).length;

    const attentionItems: Array<{ count: number; label: string; link: string }> = [];
    if (openWarranty > 0) {
      attentionItems.push({
        count: openWarranty,
        label: "Đơn bảo hành đang xử lý",
        link: "/warranties",
      });
    }
    if (machinesCheckedAwaitingTest > 0) {
      attentionItems.push({
        count: machinesCheckedAwaitingTest,
        label: "Máy đã kiểm chờ tháo",
        link: "/machines?status=CHECKED",
      });
    }
    if (defectiveOldComponents > 0) {
      attentionItems.push({
        count: defectiveOldComponents,
        label: `Linh kiện lỗi quá ${DEFECTIVE_AGE_DAYS} ngày`,
        link: "/components?status=DEFECTIVE",
      });
    }
    if (lowStockCategories > 0) {
      attentionItems.push({
        count: lowStockCategories,
        label: "Nhóm linh kiện sắp hết",
        link: "/components",
      });
    }

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
      openWarrantyCases: openWarranty,
      attentionItems,
    };
  }

  @Get("reports/profit")
  @Permissions("report:view")
  profit(@Query() q: DateRangeDto) {
    return this.reports.profit(q);
  }

  @Get("reports/inventory-value")
  @Permissions("report:view")
  inventoryValue() {
    return this.reports.inventoryValue();
  }

  @Get("reports/sales-by-product")
  @Permissions("report:view")
  salesByProduct(@Query() q: DateRangeDto) {
    return this.reports.salesByProduct(q);
  }

  @Get("reports/top-customers")
  @Permissions("report:view")
  topCustomers(@Query() q: TopCustomersDto) {
    return this.reports.topCustomers(q);
  }

  @Get("reports/inventory-aging")
  @Permissions("report:view")
  inventoryAging(@Query() q: InventoryAgingDto) {
    return this.reports.inventoryAging(q.days ?? AGING_THRESHOLD_DAYS);
  }

  @Post("reports/export")
  @Permissions("report:view")
  async export(@Body() dto: ExportReportDto) {
    const jobId = await this.reportsQueue.enqueueGenerate({
      reportType: dto.reportType,
      params: dto.params ?? {},
    });
    return { jobId };
  }

  @Get("jobs/:id/status")
  @Permissions("report:view")
  async jobStatus(@Param("id") id: string) {
    return this.reportsQueue.status(id);
  }

  // Keep FinishedPcStatus referenced for future expansion (silences unused warnings).
  static __keepEnums = FinishedPcStatus;
}
