import { HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import {
  ComponentStatus,
  FinishedPcStatus,
  Prisma,
  SalesItemType,
  SalesOrderStatus,
  StockTxnType,
} from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { CodeGeneratorService } from "../../common/utils/code-generator.service";
import { AuditLogService } from "../audit-logs/audit-logs.service";
import { StockTransactionService } from "../inventory/stock-transaction.service";
import { BusinessError } from "../../common/exceptions/business.exception";
import { RequestContextService } from "../../common/context/request-context.service";
import { buildPagination, paginate } from "../../common/utils/pagination.util";
import { CreateSaleDto, CreateSaleItemDto } from "./dto/create-sale.dto";
import { UpdateSaleDto } from "./dto/update-sale.dto";
import { QuerySaleDto } from "./dto/query-sale.dto";

const CANCEL_WINDOW_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codes: CodeGeneratorService,
    private readonly audit: AuditLogService,
    private readonly stock: StockTransactionService,
    private readonly ctx: RequestContextService,
  ) {}

  async list(q: QuerySaleDto) {
    const where: Prisma.SalesOrderWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.customerId) where.customerId = q.customerId;
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
      this.prisma.salesOrder.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          items: { select: { unitPrice: true, unitCost: true, quantity: true } },
        },
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      this.prisma.salesOrder.count({ where }),
    ]);
    const projected = items.map((s) => {
      const revenue = s.items.reduce(
        (acc, it) => acc + Number(it.unitPrice) * it.quantity,
        0,
      );
      const cost = s.items.reduce(
        (acc, it) => acc + Number(it.unitCost) * it.quantity,
        0,
      );
      const profit = s.status === SalesOrderStatus.CONFIRMED ? revenue - cost : 0;
      const { items: _omit, ...rest } = s;
      return { ...rest, revenue, cost, profit, itemCount: s.items.length };
    });
    return paginate(projected, total, q.page ?? 1, q.pageSize ?? 20);
  }

  async get(id: string) {
    const item = await this.prisma.salesOrder.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: {
            finishedPc: { select: { id: true, code: true, status: true } },
            component: {
              select: {
                id: true,
                code: true,
                model: true,
                serialNumber: true,
                category: { select: { code: true } },
              },
            },
          },
        },
      },
    });
    if (!item) {
      throw new NotFoundException({ code: "SALES_ORDER_NOT_FOUND", message: "Sales order not found" });
    }
    const revenue = item.items.reduce(
      (acc, it) => acc + Number(it.unitPrice) * it.quantity,
      0,
    );
    const cost = item.items.reduce(
      (acc, it) => acc + Number(it.unitCost) * it.quantity,
      0,
    );
    return {
      ...item,
      revenue,
      cost,
      profit: item.status === SalesOrderStatus.CONFIRMED ? revenue - cost : 0,
    };
  }

  private async validateItems(
    tx: Prisma.TransactionClient,
    items: CreateSaleItemDto[],
    excludeSalesOrderId?: string,
  ) {
    for (const it of items) {
      if (it.unitPrice < 0) {
        throw new BusinessError("INVALID_PRICE", "unitPrice must be >= 0", HttpStatus.BAD_REQUEST);
      }
      if (it.itemType === SalesItemType.FINISHED_PC) {
        if (!it.finishedPcId) {
          throw new BusinessError(
            "FINISHED_PC_REQUIRED",
            "finishedPcId is required for FINISHED_PC items",
            HttpStatus.BAD_REQUEST,
          );
        }
        if (it.qty && it.qty !== 1) {
          throw new BusinessError(
            "INVALID_QTY",
            "qty must be 1 for FINISHED_PC items",
            HttpStatus.BAD_REQUEST,
          );
        }
        const pc = await tx.finishedPc.findUnique({ where: { id: it.finishedPcId } });
        if (!pc) {
          throw new BusinessError(
            "FINISHED_PC_NOT_FOUND",
            `Finished PC ${it.finishedPcId} not found`,
            HttpStatus.NOT_FOUND,
          );
        }
        if (pc.status !== FinishedPcStatus.READY_FOR_SALE) {
          throw new BusinessError(
            "FINISHED_PC_NOT_SELLABLE",
            `Finished PC ${pc.code} is ${pc.status}, must be READY_FOR_SALE`,
            HttpStatus.CONFLICT,
          );
        }
        // Also check no other DRAFT order already references this PC
        const dup = await tx.salesItem.findFirst({
          where: {
            finishedPcId: it.finishedPcId,
            salesOrder: { status: SalesOrderStatus.DRAFT, ...(excludeSalesOrderId ? { id: { not: excludeSalesOrderId } } : {}) },
          },
        });
        if (dup) {
          throw new BusinessError(
            "FINISHED_PC_RESERVED_BY_DRAFT",
            `Finished PC ${pc.code} already in another draft sales order`,
            HttpStatus.CONFLICT,
          );
        }
      } else if (it.itemType === SalesItemType.COMPONENT) {
        if (!it.componentId) {
          throw new BusinessError(
            "COMPONENT_REQUIRED",
            "componentId is required for COMPONENT items",
            HttpStatus.BAD_REQUEST,
          );
        }
        if (it.qty && it.qty !== 1) {
          throw new BusinessError(
            "INVALID_QTY",
            "qty must be 1 for COMPONENT items",
            HttpStatus.BAD_REQUEST,
          );
        }
        const c = await tx.component.findUnique({ where: { id: it.componentId } });
        if (!c) {
          throw new BusinessError(
            "COMPONENT_NOT_FOUND",
            `Component ${it.componentId} not found`,
            HttpStatus.NOT_FOUND,
          );
        }
        if (c.status !== ComponentStatus.IN_STOCK) {
          throw new BusinessError(
            "COMPONENT_NOT_SELLABLE",
            `Component ${c.code} is ${c.status}, must be IN_STOCK`,
            HttpStatus.CONFLICT,
          );
        }
        const dup = await tx.salesItem.findFirst({
          where: {
            componentId: it.componentId,
            salesOrder: { status: SalesOrderStatus.DRAFT, ...(excludeSalesOrderId ? { id: { not: excludeSalesOrderId } } : {}) },
          },
        });
        if (dup) {
          throw new BusinessError(
            "COMPONENT_RESERVED_BY_DRAFT",
            `Component ${c.code} already in another draft sales order`,
            HttpStatus.CONFLICT,
          );
        }
      }
    }
  }

  async create(dto: CreateSaleDto) {
    return this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({ where: { id: dto.customerId } });
      if (!customer) {
        throw new BusinessError(
          "CUSTOMER_NOT_FOUND",
          `Customer ${dto.customerId} not found`,
          HttpStatus.NOT_FOUND,
        );
      }
      await this.validateItems(tx, dto.items);

      const code = await this.codes.next("SO", tx, 6);
      const totalAmount = dto.items.reduce(
        (s, it) => s + Number(it.unitPrice) * (it.qty ?? 1),
        0,
      );
      const order = await tx.salesOrder.create({
        data: {
          code,
          customerId: dto.customerId,
          status: SalesOrderStatus.DRAFT,
          totalAmount,
          notes: dto.notes ?? null,
          createdById: this.ctx.getUserId() ?? null,
        },
      });
      for (const it of dto.items) {
        const qty = it.qty ?? 1;
        await tx.salesItem.create({
          data: {
            salesOrderId: order.id,
            itemType: it.itemType,
            finishedPcId: it.finishedPcId ?? null,
            componentId: it.componentId ?? null,
            quantity: qty,
            unitPrice: it.unitPrice,
            totalPrice: it.unitPrice * qty,
          },
        });
      }

      await this.audit.record(
        { action: "sale.create", entityType: "SalesOrder", entityId: order.id, after: order },
        tx,
      );

      return this.get(order.id);
    });
  }

  async update(id: string, dto: UpdateSaleDto) {
    const before = await this.prisma.salesOrder.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!before) {
      throw new NotFoundException({ code: "SALES_ORDER_NOT_FOUND", message: "Sales order not found" });
    }
    if (before.status !== SalesOrderStatus.DRAFT) {
      throw new BusinessError(
        "INVALID_STATUS_TRANSITION",
        `Cannot update sales order in status ${before.status}`,
        HttpStatus.CONFLICT,
      );
    }
    return this.prisma.$transaction(async (tx) => {
      if (dto.items) {
        await this.validateItems(tx, dto.items, id);
        await tx.salesItem.deleteMany({ where: { salesOrderId: id } });
        for (const it of dto.items) {
          const qty = it.qty ?? 1;
          await tx.salesItem.create({
            data: {
              salesOrderId: id,
              itemType: it.itemType,
              finishedPcId: it.finishedPcId ?? null,
              componentId: it.componentId ?? null,
              quantity: qty,
              unitPrice: it.unitPrice,
              totalPrice: it.unitPrice * qty,
            },
          });
        }
      }
      const finalItems = dto.items
        ? dto.items
        : before.items.map((it) => ({
            itemType: it.itemType,
            finishedPcId: it.finishedPcId ?? undefined,
            componentId: it.componentId ?? undefined,
            unitPrice: Number(it.unitPrice),
            qty: it.quantity,
          }));
      const totalAmount = finalItems.reduce(
        (s, it) => s + Number(it.unitPrice) * (it.qty ?? 1),
        0,
      );

      const after = await tx.salesOrder.update({
        where: { id },
        data: {
          customerId: dto.customerId ?? before.customerId,
          notes: dto.notes ?? before.notes,
          totalAmount,
        },
      });
      await this.audit.record(
        { action: "sale.update", entityType: "SalesOrder", entityId: id, before, after },
        tx,
      );
      return this.get(id);
    });
  }

  async confirm(id: string) {
    const before = await this.prisma.salesOrder.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            finishedPc: { include: { currentComponents: true } },
            component: true,
          },
        },
      },
    });
    if (!before) {
      throw new NotFoundException({ code: "SALES_ORDER_NOT_FOUND", message: "Sales order not found" });
    }
    if (before.status !== SalesOrderStatus.DRAFT) {
      throw new BusinessError(
        "INVALID_STATUS_TRANSITION",
        `Sales order already ${before.status}`,
        HttpStatus.CONFLICT,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      let totalAmount = 0;
      for (const it of before.items) {
        if (it.itemType === SalesItemType.FINISHED_PC) {
          if (!it.finishedPc) {
            throw new BusinessError(
              "FINISHED_PC_NOT_FOUND",
              `FinishedPc missing for sales item ${it.id}`,
              HttpStatus.CONFLICT,
            );
          }
          if (it.finishedPc.status !== FinishedPcStatus.READY_FOR_SALE) {
            throw new BusinessError(
              "FINISHED_PC_NOT_SELLABLE",
              `Finished PC ${it.finishedPc.code} status changed to ${it.finishedPc.status}`,
              HttpStatus.CONFLICT,
            );
          }
          const itemCost = Number(it.finishedPc.costPrice);
          await tx.salesItem.update({
            where: { id: it.id },
            data: { unitCost: itemCost },
          });

          await tx.finishedPc.update({
            where: { id: it.finishedPc.id },
            data: {
              status: FinishedPcStatus.SOLD,
              soldPrice: it.unitPrice,
              soldAt: new Date(),
            },
          });

          for (const c of it.finishedPc.currentComponents) {
            await this.stock.create(
              {
                componentId: c.id,
                type: StockTxnType.OUT,
                reason: `Sold via ${before.code}`,
                refType: "SALES_ORDER",
                refId: before.id,
                newComponentStatus: ComponentStatus.SOLD,
              },
              tx,
            );
          }
        } else if (it.itemType === SalesItemType.COMPONENT) {
          if (!it.component) {
            throw new BusinessError(
              "COMPONENT_NOT_FOUND",
              `Component missing for sales item ${it.id}`,
              HttpStatus.CONFLICT,
            );
          }
          if (it.component.status !== ComponentStatus.IN_STOCK) {
            throw new BusinessError(
              "COMPONENT_NOT_SELLABLE",
              `Component ${it.component.code} status changed to ${it.component.status}`,
              HttpStatus.CONFLICT,
            );
          }
          const itemCost = Number(it.component.costPrice);
          await tx.salesItem.update({
            where: { id: it.id },
            data: { unitCost: itemCost },
          });
          await this.stock.create(
            {
              componentId: it.component.id,
              type: StockTxnType.OUT,
              reason: `Sold via ${before.code}`,
              refType: "SALES_ORDER",
              refId: before.id,
              newComponentStatus: ComponentStatus.SOLD,
            },
            tx,
          );
        }
        totalAmount += Number(it.unitPrice) * it.quantity;
      }

      const after = await tx.salesOrder.update({
        where: { id },
        data: {
          status: SalesOrderStatus.CONFIRMED,
          confirmedAt: new Date(),
          totalAmount,
        },
      });
      await this.audit.record(
        { action: "sale.confirm", entityType: "SalesOrder", entityId: id, before, after },
        tx,
      );
      return this.get(id);
    });
  }

  async cancel(id: string) {
    const before = await this.prisma.salesOrder.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            finishedPc: { include: { componentLinks: true } },
            component: true,
          },
        },
      },
    });
    if (!before) {
      throw new NotFoundException({ code: "SALES_ORDER_NOT_FOUND", message: "Sales order not found" });
    }
    if (before.status !== SalesOrderStatus.CONFIRMED) {
      throw new BusinessError(
        "INVALID_STATUS_TRANSITION",
        `Cannot cancel sales order in status ${before.status}`,
        HttpStatus.CONFLICT,
      );
    }
    if (
      before.confirmedAt &&
      Date.now() - before.confirmedAt.getTime() > CANCEL_WINDOW_MS
    ) {
      throw new BusinessError(
        "CANCEL_WINDOW_EXPIRED",
        "Sales order can only be cancelled within 24h of confirmation",
        HttpStatus.CONFLICT,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      for (const it of before.items) {
        if (it.itemType === SalesItemType.FINISHED_PC && it.finishedPc) {
          await tx.finishedPc.update({
            where: { id: it.finishedPc.id },
            data: {
              status: FinishedPcStatus.READY_FOR_SALE,
              soldPrice: null,
              soldAt: null,
            },
          });
          for (const link of it.finishedPc.componentLinks) {
            if (link.removedAt !== null) continue;
            await this.stock.create(
              {
                componentId: link.componentId,
                type: StockTxnType.RETURN,
                reason: `Sale ${before.code} cancelled`,
                refType: "SALES_ORDER",
                refId: before.id,
                newComponentStatus: ComponentStatus.ASSEMBLED,
              },
              tx,
            );
          }
        } else if (it.itemType === SalesItemType.COMPONENT && it.component) {
          await this.stock.create(
            {
              componentId: it.component.id,
              type: StockTxnType.RETURN,
              reason: `Sale ${before.code} cancelled`,
              refType: "SALES_ORDER",
              refId: before.id,
              newComponentStatus: ComponentStatus.IN_STOCK,
            },
            tx,
          );
        }
      }
      const after = await tx.salesOrder.update({
        where: { id },
        data: { status: SalesOrderStatus.CANCELLED, cancelledAt: new Date() },
      });
      await this.audit.record(
        { action: "sale.cancel", entityType: "SalesOrder", entityId: id, before, after },
        tx,
      );
      return this.get(id);
    });
  }
}
