import { HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, gte, inArray, like, lte, ne, or, sql, type SQL } from "drizzle-orm";
import {
  ComponentStatus,
  FinishedPcStatus,
  SalesItemType,
  SalesOrderStatus,
  StockTxnType,
} from "@app/shared";
import { DbService, DrizzleDb } from "../../database/db.service";
import { components, customers, finishedPcs, salesItems, salesOrders } from "../../database/schema";
import { createId } from "../../database/id";
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
    private readonly dbs: DbService,
    private readonly codes: CodeGeneratorService,
    private readonly audit: AuditLogService,
    private readonly stock: StockTransactionService,
    private readonly ctx: RequestContextService,
  ) {}

  async list(q: QuerySaleDto) {
    const conds: SQL[] = [];
    if (q.status) conds.push(eq(salesOrders.status, q.status));
    if (q.customerId) conds.push(eq(salesOrders.customerId, q.customerId));
    if (q.fromDate) conds.push(gte(salesOrders.createdAt, new Date(q.fromDate)));
    if (q.toDate) conds.push(lte(salesOrders.createdAt, new Date(q.toDate)));
    if (q.search) {
      const term = `%${q.search}%`;
      const searchCond = or(
        like(salesOrders.code, term),
        like(salesOrders.orderName, term),
        like(salesOrders.sellerName, term),
        like(salesOrders.platform, term),
      );
      if (searchCond) conds.push(searchCond);
    }
    const where = conds.length ? and(...conds) : undefined;
    const { take, skip } = buildPagination(q.page, q.pageSize);
    const db = this.dbs.db;
    const items = await db.query.salesOrders.findMany({
      where,
      with: {
        customer: { columns: { id: true, name: true, phone: true } },
        items: { columns: { unitPrice: true, unitCost: true, quantity: true } },
      },
      orderBy: [desc(salesOrders.createdAt)],
      limit: take,
      offset: skip,
    });
    const totalRows = await db
      .select({ count: sql<number>`count(*)`.as("count") })
      .from(salesOrders)
      .where(where);
    const total = Number(totalRows[0]?.count ?? 0);
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

  async get(id: string, db?: DrizzleDb) {
    const client = db ?? this.dbs.db;
    const item = await client.query.salesOrders.findFirst({
      where: eq(salesOrders.id, id),
      with: {
        customer: true,
        items: {
          with: {
            finishedPc: { columns: { id: true, code: true, status: true } },
            component: {
              columns: { id: true, code: true, model: true, serialNumber: true },
              with: { category: { columns: { code: true } } },
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
    db: DrizzleDb,
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
        const pc = (
          await db.select().from(finishedPcs).where(eq(finishedPcs.id, it.finishedPcId)).limit(1)
        )[0];
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
        const draftOrderConds: SQL[] = [eq(salesOrders.status, SalesOrderStatus.DRAFT)];
        if (excludeSalesOrderId) draftOrderConds.push(ne(salesOrders.id, excludeSalesOrderId));
        const dup = (
          await db
            .select({ id: salesItems.id })
            .from(salesItems)
            .where(
              and(
                eq(salesItems.finishedPcId, it.finishedPcId),
                inArray(
                  salesItems.salesOrderId,
                  db.select({ id: salesOrders.id }).from(salesOrders).where(and(...draftOrderConds)),
                ),
              ),
            )
            .limit(1)
        )[0];
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
        const c = (
          await db.select().from(components).where(eq(components.id, it.componentId)).limit(1)
        )[0];
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
        const draftOrderConds: SQL[] = [eq(salesOrders.status, SalesOrderStatus.DRAFT)];
        if (excludeSalesOrderId) draftOrderConds.push(ne(salesOrders.id, excludeSalesOrderId));
        const dup = (
          await db
            .select({ id: salesItems.id })
            .from(salesItems)
            .where(
              and(
                eq(salesItems.componentId, it.componentId),
                inArray(
                  salesItems.salesOrderId,
                  db.select({ id: salesOrders.id }).from(salesOrders).where(and(...draftOrderConds)),
                ),
              ),
            )
            .limit(1)
        )[0];
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
    return this.dbs.transaction(async (db) => {
      const customer = (
        await db.select().from(customers).where(eq(customers.id, dto.customerId)).limit(1)
      )[0];
      if (!customer) {
        throw new BusinessError(
          "CUSTOMER_NOT_FOUND",
          `Customer ${dto.customerId} not found`,
          HttpStatus.NOT_FOUND,
        );
      }
      await this.validateItems(db, dto.items);

      const code = await this.codes.next("SO", db, 6);
      const totalAmount = dto.items.reduce(
        (s, it) => s + Number(it.unitPrice) * (it.qty ?? 1),
        0,
      );
      const order = (
        await db
          .insert(salesOrders)
          .values({
            id: createId(),
            code,
            customerId: dto.customerId,
            orderName: dto.orderName ?? null,
            sellerName: dto.sellerName ?? null,
            platform: dto.platform ?? null,
            salesUrl: dto.salesUrl ?? null,
            status: SalesOrderStatus.DRAFT,
            totalAmount,
            notes: dto.notes ?? null,
            createdById: this.ctx.getUserId() ?? null,
          })
          .returning()
      )[0];
      for (const it of dto.items) {
        const qty = it.qty ?? 1;
        await db.insert(salesItems).values({
          id: createId(),
          salesOrderId: order.id,
          itemType: it.itemType,
          finishedPcId: it.finishedPcId ?? null,
          componentId: it.componentId ?? null,
          quantity: qty,
          unitPrice: it.unitPrice,
          totalPrice: it.unitPrice * qty,
        });
      }

      await this.audit.record(
        { action: "sale.create", entityType: "SalesOrder", entityId: order.id, after: order },
        db,
      );

      return this.get(order.id, db);
    });
  }

  async update(id: string, dto: UpdateSaleDto) {
    const before = await this.dbs.db.query.salesOrders.findFirst({
      where: eq(salesOrders.id, id),
      with: { items: true },
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
    return this.dbs.transaction(async (db) => {
      if (dto.items) {
        await this.validateItems(db, dto.items, id);
        await db.delete(salesItems).where(eq(salesItems.salesOrderId, id));
        for (const it of dto.items) {
          const qty = it.qty ?? 1;
          await db.insert(salesItems).values({
            id: createId(),
            salesOrderId: id,
            itemType: it.itemType,
            finishedPcId: it.finishedPcId ?? null,
            componentId: it.componentId ?? null,
            quantity: qty,
            unitPrice: it.unitPrice,
            totalPrice: it.unitPrice * qty,
          });
        }
      }
      const finalItems: CreateSaleItemDto[] = dto.items
        ? dto.items
        : before.items.map((it) => ({
            itemType: it.itemType as SalesItemType,
            finishedPcId: it.finishedPcId ?? undefined,
            componentId: it.componentId ?? undefined,
            unitPrice: Number(it.unitPrice),
            qty: it.quantity,
          }));
      const totalAmount = finalItems.reduce(
        (s, it) => s + Number(it.unitPrice) * (it.qty ?? 1),
        0,
      );

      const after = (
        await db
          .update(salesOrders)
          .set({
            customerId: dto.customerId ?? before.customerId,
            orderName: dto.orderName ?? before.orderName,
            sellerName: dto.sellerName ?? before.sellerName,
            platform: dto.platform ?? before.platform,
            salesUrl: dto.salesUrl ?? before.salesUrl,
            notes: dto.notes ?? before.notes,
            totalAmount,
            updatedAt: new Date(),
          })
          .where(eq(salesOrders.id, id))
          .returning()
      )[0];
      await this.audit.record(
        { action: "sale.update", entityType: "SalesOrder", entityId: id, before, after },
        db,
      );
      return this.get(id, db);
    });
  }

  async confirm(id: string) {
    const before = await this.dbs.db.query.salesOrders.findFirst({
      where: eq(salesOrders.id, id),
      with: {
        items: {
          with: {
            finishedPc: { with: { currentComponents: true } },
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

    return this.dbs.transaction(async (db) => {
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
          const pcUpdate = await db
            .update(finishedPcs)
            .set({
              status: FinishedPcStatus.SOLD,
              soldPrice: it.unitPrice,
              soldAt: new Date(),
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(finishedPcs.id, it.finishedPc.id),
                eq(finishedPcs.status, FinishedPcStatus.READY_FOR_SALE),
              ),
            )
            .returning({ id: finishedPcs.id });
          if (pcUpdate.length !== 1) {
            throw new BusinessError(
              "FINISHED_PC_NOT_SELLABLE",
              `Finished PC ${it.finishedPc.code} khong con san sang ban`,
              HttpStatus.CONFLICT,
            );
          }
          const itemCost = Number(it.finishedPc.costPrice);
          await db
            .update(salesItems)
            .set({ unitCost: itemCost, updatedAt: new Date() })
            .where(eq(salesItems.id, it.id));

          for (const c of it.finishedPc.currentComponents) {
            const ok = await this.stock.tryTransitionComponent(
              c.id,
              c.status,
              ComponentStatus.SOLD,
              {
                type: StockTxnType.OUT,
                reason: `Sold via ${before.code}`,
                refType: "SALES_ORDER",
                refId: before.id,
              },
              db,
            );
            if (!ok) {
              throw new BusinessError(
                "COMPONENT_NOT_SELLABLE",
                `Linh kien ${c.code} khong con kha dung`,
                HttpStatus.CONFLICT,
              );
            }
          }
        } else if (it.itemType === SalesItemType.COMPONENT) {
          if (!it.component) {
            throw new BusinessError(
              "COMPONENT_NOT_FOUND",
              `Component missing for sales item ${it.id}`,
              HttpStatus.CONFLICT,
            );
          }
          const ok = await this.stock.tryTransitionComponent(
            it.component.id,
            ComponentStatus.IN_STOCK,
            ComponentStatus.SOLD,
            {
              type: StockTxnType.OUT,
              reason: `Sold via ${before.code}`,
              refType: "SALES_ORDER",
              refId: before.id,
            },
            db,
          );
          if (!ok) {
            throw new BusinessError(
              "COMPONENT_NOT_SELLABLE",
              `Linh kien ${it.component.code} khong con kha dung`,
              HttpStatus.CONFLICT,
            );
          }
          const itemCost = Number(it.component.costPrice);
          await db
            .update(salesItems)
            .set({ unitCost: itemCost, updatedAt: new Date() })
            .where(eq(salesItems.id, it.id));
        }
        totalAmount += Number(it.unitPrice) * it.quantity;
      }

      const after = (
        await db
          .update(salesOrders)
          .set({
            status: SalesOrderStatus.CONFIRMED,
            confirmedAt: new Date(),
            totalAmount,
            updatedAt: new Date(),
          })
          .where(eq(salesOrders.id, id))
          .returning()
      )[0];
      await this.audit.record(
        { action: "sale.confirm", entityType: "SalesOrder", entityId: id, before, after },
        db,
      );
      return this.get(id, db);
    });
  }

  async cancel(id: string) {
    const before = await this.dbs.db.query.salesOrders.findFirst({
      where: eq(salesOrders.id, id),
      with: {
        items: {
          with: {
            finishedPc: { with: { componentLinks: true } },
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
      Date.now() - new Date(before.confirmedAt).getTime() > CANCEL_WINDOW_MS
    ) {
      throw new BusinessError(
        "CANCEL_WINDOW_EXPIRED",
        "Sales order can only be cancelled within 24h of confirmation",
        HttpStatus.CONFLICT,
      );
    }

    return this.dbs.transaction(async (db) => {
      for (const it of before.items) {
        if (it.itemType === SalesItemType.FINISHED_PC && it.finishedPc) {
          await db
            .update(finishedPcs)
            .set({
              status: FinishedPcStatus.READY_FOR_SALE,
              soldPrice: null,
              soldAt: null,
              updatedAt: new Date(),
            })
            .where(eq(finishedPcs.id, it.finishedPc.id));
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
              db,
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
            db,
          );
        }
      }
      const after = (
        await db
          .update(salesOrders)
          .set({
            status: SalesOrderStatus.CANCELLED,
            cancelledAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(salesOrders.id, id))
          .returning()
      )[0];
      await this.audit.record(
        { action: "sale.cancel", entityType: "SalesOrder", entityId: id, before, after },
        db,
      );
      return this.get(id, db);
    });
  }
}
