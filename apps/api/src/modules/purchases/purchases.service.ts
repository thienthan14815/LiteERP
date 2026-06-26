import { HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import {
  ComponentStatus,
  MachineStatus,
  Prisma,
  PurchaseItemType,
  PurchaseOrderStatus,
  StockTxnType,
} from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { CodeGeneratorService } from "../../common/utils/code-generator.service";
import { AuditLogService } from "../audit-logs/audit-logs.service";
import { StockTransactionService } from "../inventory/stock-transaction.service";
import { BusinessError } from "../../common/exceptions/business.exception";
import { RequestContextService } from "../../common/context/request-context.service";
import { buildPagination, paginate } from "../../common/utils/pagination.util";
import { CreatePurchaseDto } from "./dto/create-purchase.dto";
import { UpdatePurchaseDto } from "./dto/update-purchase.dto";
import { QueryPurchaseDto } from "./dto/query-purchase.dto";

@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codes: CodeGeneratorService,
    private readonly audit: AuditLogService,
    private readonly stock: StockTransactionService,
    private readonly ctx: RequestContextService,
  ) {}

  async list(q: QueryPurchaseDto) {
    const where: Prisma.PurchaseOrderWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.supplierId) where.supplierId = q.supplierId;
    if (q.fromDate || q.toDate) {
      where.createdAt = {};
      if (q.fromDate) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(q.fromDate);
      if (q.toDate) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(q.toDate);
    }
    if (q.search) {
      where.OR = [{ code: { contains: q.search, mode: "insensitive" } }];
    }
    const { take, skip } = buildPagination(q.page, q.pageSize);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.purchaseOrder.findMany({
        where,
        include: { supplier: true, _count: { select: { items: true } } },
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);
    return paginate(items, total, q.page ?? 1, q.pageSize ?? 20);
  }

  async get(id: string) {
    const item = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: { include: { machines: true } },
      },
    });
    if (!item) throw new NotFoundException({ code: "PURCHASE_NOT_FOUND", message: "Purchase order not found" });
    return item;
  }

  async create(dto: CreatePurchaseDto) {
    return this.prisma.$transaction(async (tx) => {
      const code = await this.codes.next("PO", tx, 6);
      const itemsTotal = dto.items.reduce(
        (s, it) => s + Number(it.unitPrice) * Number(it.quantity),
        0,
      );
      const totalAmount = itemsTotal + Number(dto.otherCost ?? 0);

      const order = await tx.purchaseOrder.create({
        data: {
          code,
          supplierId: dto.supplierId ?? null,
          status: PurchaseOrderStatus.DRAFT,
          totalAmount,
          otherCost: dto.otherCost ?? 0,
          notes: dto.notes ?? null,
          createdById: this.ctx.getUserId() ?? null,
        },
      });

      for (const it of dto.items) {
        const totalPrice = Number(it.unitPrice) * Number(it.quantity);
        const purchaseItem = await tx.purchaseItem.create({
          data: {
            purchaseOrderId: order.id,
            itemType: it.itemType,
            description: it.description,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            totalPrice,
            notes: it.notes ?? null,
          },
        });

        if (it.itemType === PurchaseItemType.MACHINE) {
          for (let i = 0; i < it.quantity; i++) {
            const machineCode = await this.codes.next("PC", tx, 6);
            await tx.machine.create({
              data: {
                code: machineCode,
                purchaseItemId: purchaseItem.id,
                status: MachineStatus.NEW,
                cost: it.unitPrice,
                createdById: this.ctx.getUserId() ?? null,
              },
            });
          }
        } else if (it.itemType === PurchaseItemType.COMPONENT) {
          if (!it.categoryCode) {
            throw new BusinessError(
              "COMPONENT_CATEGORY_REQUIRED",
              `Category code required for COMPONENT item: ${it.description}`,
            );
          }
          const category = await tx.componentCategory.findUnique({ where: { code: it.categoryCode } });
          if (!category) {
            throw new BusinessError(
              "COMPONENT_CATEGORY_NOT_FOUND",
              `Component category ${it.categoryCode} not found`,
            );
          }
          for (let i = 0; i < it.quantity; i++) {
            const compCode = await this.codes.next(category.prefix, tx, 6);
            await tx.component.create({
              data: {
                code: compCode,
                categoryId: category.id,
                status: ComponentStatus.IN_STOCK,
                costPrice: it.unitPrice,
                createdById: this.ctx.getUserId() ?? null,
                notes: `Purchase item ${purchaseItem.id}`,
              },
            });
          }
        }
      }

      await this.audit.record(
        { action: "purchase.create", entityType: "PurchaseOrder", entityId: order.id, after: order },
        tx,
      );

      return tx.purchaseOrder.findUniqueOrThrow({
        where: { id: order.id },
        include: { supplier: true, items: { include: { machines: true } } },
      });
    });
  }

  async update(id: string, dto: UpdatePurchaseDto) {
    const before = await this.prisma.purchaseOrder.findUnique({ where: { id } });
    if (!before) throw new NotFoundException({ code: "PURCHASE_NOT_FOUND", message: "Purchase order not found" });
    if (before.status !== PurchaseOrderStatus.DRAFT) {
      throw new BusinessError(
        "INVALID_STATUS_TRANSITION",
        `Cannot update purchase in status ${before.status}`,
        HttpStatus.CONFLICT,
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.purchaseOrder.update({
        where: { id },
        data: {
          supplierId: dto.supplierId ?? before.supplierId,
          notes: dto.notes ?? before.notes,
          otherCost: dto.otherCost ?? before.otherCost,
        },
      });
      await this.audit.record(
        { action: "purchase.update", entityType: "PurchaseOrder", entityId: id, before, after: order },
        tx,
      );
      return order;
    });
  }

  async confirm(id: string) {
    const before = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!before) throw new NotFoundException({ code: "PURCHASE_NOT_FOUND", message: "Purchase order not found" });
    if (before.status !== PurchaseOrderStatus.DRAFT) {
      throw new BusinessError(
        "INVALID_STATUS_TRANSITION",
        `Purchase already ${before.status}`,
        HttpStatus.CONFLICT,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.purchaseOrder.update({
        where: { id },
        data: { status: PurchaseOrderStatus.CONFIRMED, confirmedAt: new Date() },
      });

      // Component items: create one StockTransaction.IN per Component created
      // during draft creation. Machine items remain status=NEW for inspection.
      const componentItems = before.items.filter(
        (it) => it.itemType === PurchaseItemType.COMPONENT,
      );
      for (const it of componentItems) {
        const components = await tx.component.findMany({
          where: { notes: `Purchase item ${it.id}` },
        });
        for (const c of components) {
          await this.stock.create(
            {
              componentId: c.id,
              type: StockTxnType.IN,
              reason: "Purchase confirmation",
              refType: "PURCHASE_ITEM",
              refId: it.id,
            },
            tx,
          );
        }
      }

      await this.audit.record(
        {
          action: "purchase.confirm",
          entityType: "PurchaseOrder",
          entityId: id,
          before,
          after: order,
        },
        tx,
      );

      return tx.purchaseOrder.findUniqueOrThrow({
        where: { id },
        include: { items: { include: { machines: true } }, supplier: true },
      });
    });
  }

  async cancel(id: string) {
    const before = await this.prisma.purchaseOrder.findUnique({ where: { id } });
    if (!before) throw new NotFoundException({ code: "PURCHASE_NOT_FOUND", message: "Purchase order not found" });
    if (before.status !== PurchaseOrderStatus.DRAFT) {
      throw new BusinessError(
        "INVALID_STATUS_TRANSITION",
        `Cannot cancel purchase in status ${before.status}`,
        HttpStatus.CONFLICT,
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.purchaseOrder.update({
        where: { id },
        data: { status: PurchaseOrderStatus.CANCELLED, cancelledAt: new Date() },
      });
      await this.audit.record(
        { action: "purchase.cancel", entityType: "PurchaseOrder", entityId: id, before, after: order },
        tx,
      );
      return order;
    });
  }
}
