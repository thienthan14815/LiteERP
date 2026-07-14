import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsInt, IsISO8601, IsOptional, IsString, Max, Min } from "class-validator";
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import {
  ComponentStatus,
  MachineStatus,
  SalesOrderStatus,
  WarrantyStatus,
} from "@app/shared";
import { DbService } from "../../database/db.service";
import {
  components,
  machines,
  salesItems,
  salesOrders,
  warrantyCases,
} from "../../database/schema";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { computeStockValue } from "../../common/utils/stock-value.util";
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
    private readonly dbs: DbService,
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

    const db = this.dbs.db;
    const [
      salesItemsThisMonth,
      machineByStatus,
      componentByStatus,
      awaitingInspectionRows,
      machinesCheckedRows,
      stockValue,
      openWarrantyRows,
      defectiveOldRows,
      agingByCategory,
    ] = await Promise.all([
      db
        .select({
          unitPrice: salesItems.unitPrice,
          unitCost: salesItems.unitCost,
          quantity: salesItems.quantity,
        })
        .from(salesItems)
        .innerJoin(salesOrders, eq(salesItems.salesOrderId, salesOrders.id))
        .where(
          and(
            eq(salesOrders.status, SalesOrderStatus.CONFIRMED),
            gte(salesOrders.confirmedAt, monthStart),
          ),
        ),
      db
        .select({ status: machines.status, count: sql<number>`count(*)`.as("count") })
        .from(machines)
        .groupBy(machines.status),
      db
        .select({ status: components.status, count: sql<number>`count(*)`.as("count") })
        .from(components)
        .groupBy(components.status),
      db
        .select({ count: sql<number>`count(*)`.as("count") })
        .from(machines)
        .where(eq(machines.status, MachineStatus.NEW)),
      db
        .select({ count: sql<number>`count(*)`.as("count") })
        .from(machines)
        .where(eq(machines.status, MachineStatus.CHECKED)),
      // KPI "Giá trị tồn kho": linh kiện + máy cũ + PC thành phẩm chưa bán.
      computeStockValue(db),
      db
        .select({ count: sql<number>`count(*)`.as("count") })
        .from(warrantyCases)
        .where(
          inArray(warrantyCases.status, [
            WarrantyStatus.RECEIVED,
            WarrantyStatus.INSPECTING,
            WarrantyStatus.REPAIRING,
            WarrantyStatus.REPLACED,
          ]),
        ),
      db
        .select({ count: sql<number>`count(*)`.as("count") })
        .from(components)
        .where(
          and(
            eq(components.status, ComponentStatus.DEFECTIVE),
            lte(components.updatedAt, defectiveCutoff),
          ),
        ),
      db
        .select({ categoryId: components.categoryId, count: sql<number>`count(*)`.as("count") })
        .from(components)
        .where(eq(components.status, ComponentStatus.IN_STOCK))
        .groupBy(components.categoryId),
    ]);

    const awaitingInspection = Number(awaitingInspectionRows[0]?.count ?? 0);
    const machinesCheckedAwaitingTest = Number(machinesCheckedRows[0]?.count ?? 0);
    const openWarranty = Number(openWarrantyRows[0]?.count ?? 0);
    const defectiveOldComponents = Number(defectiveOldRows[0]?.count ?? 0);

    const revenue = salesItemsThisMonth.reduce(
      (s, it) => s + Number(it.unitPrice) * it.quantity,
      0,
    );
    const costFromItems = salesItemsThisMonth.reduce(
      (s, it) => s + Number(it.unitCost) * it.quantity,
      0,
    );
    const profit = revenue - costFromItems;
    const inventoryValue = stockValue.totalValue;

    const lowStockCategories = agingByCategory.filter(
      (g) => Number(g.count) < LOW_STOCK_CATEGORY_THRESHOLD,
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
        machineByStatus.map((g) => [g.status, Number(g.count)]),
      ),
      componentsByStatus: Object.fromEntries(
        componentByStatus.map((g) => [g.status, Number(g.count)]),
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
}
