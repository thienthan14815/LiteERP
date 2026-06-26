import { Injectable, NotFoundException } from "@nestjs/common";
import { ComponentStatus, Prisma, StockTxnType } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { AuditLogService } from "../audit-logs/audit-logs.service";
import { StockTransactionService } from "../inventory/stock-transaction.service";
import { BusinessError } from "../../common/exceptions/business.exception";
import { buildPagination, paginate } from "../../common/utils/pagination.util";
import { QueryComponentDto } from "./dto/query-component.dto";
import { UpdateComponentDto } from "./dto/update-component.dto";

@Injectable()
export class ComponentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly stock: StockTransactionService,
  ) {}

  async list(q: QueryComponentDto) {
    const where: Prisma.ComponentWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.condition) where.condition = q.condition;
    if (q.categoryId) where.categoryId = q.categoryId;
    if (q.categoryCode) {
      where.category = { code: q.categoryCode };
    }
    if (q.search) {
      where.OR = [
        { code: { contains: q.search, mode: "insensitive" } },
        { serialNumber: { contains: q.search, mode: "insensitive" } },
        { model: { contains: q.search, mode: "insensitive" } },
      ];
    }
    const { take, skip } = buildPagination(q.page, q.pageSize);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.component.findMany({
        where,
        include: { category: true },
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      this.prisma.component.count({ where }),
    ]);
    return paginate(items, total, q.page ?? 1, q.pageSize ?? 20);
  }

  async get(id: string) {
    const item = await this.prisma.component.findUnique({
      where: { id },
      include: {
        category: true,
        sourceMachine: true,
        currentFinishedPc: true,
        finishedPcLinks: { include: { finishedPc: true } },
        stockTransactions: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!item) throw new NotFoundException({ code: "COMPONENT_NOT_FOUND", message: "Component not found" });
    return item;
  }

  async getBySerial(serial: string) {
    const item = await this.prisma.component.findFirst({
      where: { serialNumber: serial },
      include: { category: true, currentFinishedPc: true, sourceMachine: true },
    });
    if (!item) throw new NotFoundException({ code: "COMPONENT_NOT_FOUND", message: "Component not found" });
    return item;
  }

  async update(id: string, dto: UpdateComponentDto) {
    const before = await this.prisma.component.findUnique({ where: { id } });
    if (!before) throw new NotFoundException({ code: "COMPONENT_NOT_FOUND", message: "Component not found" });
    return this.prisma.$transaction(async (tx) => {
      const after = await tx.component.update({
        where: { id },
        data: {
          condition: dto.condition ?? before.condition,
          location: dto.location ?? before.location,
          model: dto.model ?? before.model,
          serialNumber: dto.serialNumber ?? before.serialNumber,
          costPrice: dto.costPrice ?? before.costPrice,
          notes: dto.notes ?? before.notes,
        },
      });
      await this.audit.record(
        { action: "component.update", entityType: "Component", entityId: id, before, after },
        tx,
      );
      return after;
    });
  }

  async scrap(id: string) {
    const before = await this.prisma.component.findUnique({ where: { id } });
    if (!before) throw new NotFoundException({ code: "COMPONENT_NOT_FOUND", message: "Component not found" });
    if (before.status !== ComponentStatus.IN_STOCK) {
      throw new BusinessError(
        "INVALID_STATUS_TRANSITION",
        `Cannot scrap component in status ${before.status}`,
        409 as any,
      );
    }
    return this.prisma.$transaction(async (tx) => {
      await this.stock.create(
        {
          componentId: id,
          type: StockTxnType.SCRAP,
          reason: "Component scrapped",
          newComponentStatus: ComponentStatus.SCRAPPED,
          refType: "COMPONENT",
          refId: id,
        },
        tx,
      );
      const after = await tx.component.findUniqueOrThrow({ where: { id } });
      await this.audit.record(
        { action: "component.scrap", entityType: "Component", entityId: id, before, after },
        tx,
      );
      return after;
    });
  }
}
