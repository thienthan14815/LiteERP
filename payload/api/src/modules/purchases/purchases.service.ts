import { HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, gte, inArray, like, lte, sql, type SQL } from "drizzle-orm";
import {
  ComponentStatus,
  MachineStatus,
  PurchaseItemType,
  PurchaseOrderStatus,
  StockTxnType,
} from "@app/shared";
import { DbService, DrizzleDb } from "../../database/db.service";
import {
  componentCategories,
  components,
  machines,
  purchaseItems,
  purchaseOrders,
} from "../../database/schema";
import { createId } from "../../database/id";
import { CodeGeneratorService } from "../../common/utils/code-generator.service";
import { AuditLogService } from "../audit-logs/audit-logs.service";
import { StockTransactionService } from "../inventory/stock-transaction.service";
import { BusinessError } from "../../common/exceptions/business.exception";
import { RequestContextService } from "../../common/context/request-context.service";
import { buildPagination, paginate } from "../../common/utils/pagination.util";
import { CreatePurchaseDto } from "./dto/create-purchase.dto";
import { UpdatePurchaseDto } from "./dto/update-purchase.dto";
import { UpdatePurchaseItemDto } from "./dto/update-purchase-item.dto";
import { QueryPurchaseDto } from "./dto/query-purchase.dto";

@Injectable()
export class PurchasesService {
  constructor(
    private readonly dbs: DbService,
    private readonly codes: CodeGeneratorService,
    private readonly audit: AuditLogService,
    private readonly stock: StockTransactionService,
    private readonly ctx: RequestContextService,
  ) {}

  async list(q: QueryPurchaseDto) {
    const conds: SQL[] = [];
    if (q.status) conds.push(eq(purchaseOrders.status, q.status));
    if (q.supplierId) conds.push(eq(purchaseOrders.supplierId, q.supplierId));
    if (q.fromDate) conds.push(gte(purchaseOrders.createdAt, new Date(q.fromDate)));
    if (q.toDate) conds.push(lte(purchaseOrders.createdAt, new Date(q.toDate)));
    if (q.search) conds.push(like(purchaseOrders.code, `%${q.search}%`));
    const where = conds.length ? and(...conds) : undefined;
    const { take, skip } = buildPagination(q.page, q.pageSize);
    const db = this.dbs.db;
    const rows = await db.query.purchaseOrders.findMany({
      where,
      with: { supplier: true },
      orderBy: [desc(purchaseOrders.createdAt)],
      limit: take,
      offset: skip,
    });
    const totalRows = await db
      .select({ count: sql<number>`count(*)`.as("count") })
      .from(purchaseOrders)
      .where(where);
    const total = Number(totalRows[0]?.count ?? 0);
    // _count.items emulation: one grouped query for the whole page.
    const ids = rows.map((po) => po.id);
    const counts = ids.length
      ? await db
          .select({
            refId: purchaseItems.purchaseOrderId,
            count: sql<number>`count(*)`.as("count"),
          })
          .from(purchaseItems)
          .where(inArray(purchaseItems.purchaseOrderId, ids))
          .groupBy(purchaseItems.purchaseOrderId)
      : [];
    const countMap = new Map(counts.map((c) => [c.refId, Number(c.count)]));
    const items = rows.map((po) => ({ ...po, _count: { items: countMap.get(po.id) ?? 0 } }));
    return paginate(items, total, q.page ?? 1, q.pageSize ?? 20);
  }

  async get(id: string) {
    const item = await this.dbs.db.query.purchaseOrders.findFirst({
      where: eq(purchaseOrders.id, id),
      with: {
        supplier: true,
        items: { with: { machines: true } },
      },
    });
    if (!item) throw new NotFoundException({ code: "PURCHASE_NOT_FOUND", message: "Purchase order not found" });
    return item;
  }

  async create(dto: CreatePurchaseDto) {
    return this.dbs.transaction(async (db) => {
      const code = await this.codes.next("PO", db, 6);
      const itemsTotal = dto.items.reduce(
        (s, it) => s + Number(it.unitPrice) * Number(it.quantity),
        0,
      );
      const totalAmount = itemsTotal + Number(dto.otherCost ?? 0);

      const orderRows = await db
        .insert(purchaseOrders)
        .values({
          id: createId(),
          code,
          supplierId: dto.supplierId ?? null,
          status: PurchaseOrderStatus.DRAFT,
          totalAmount,
          otherCost: dto.otherCost ?? 0,
          notes: dto.notes ?? null,
          createdById: this.ctx.getUserId() ?? null,
        })
        .returning();
      const order = orderRows[0];

      for (const it of dto.items) {
        const totalPrice = Number(it.unitPrice) * Number(it.quantity);
        const purchaseItemRows = await db
          .insert(purchaseItems)
          .values({
            id: createId(),
            purchaseOrderId: order.id,
            itemType: it.itemType,
            description: it.description,
            model: it.model ?? null,
            serial: it.serial ?? null,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            totalPrice,
            notes: it.notes ?? null,
          })
          .returning();
        const purchaseItem = purchaseItemRows[0];

        if (it.itemType === PurchaseItemType.MACHINE) {
          for (let i = 0; i < it.quantity; i++) {
            const machineCode = await this.codes.next("PC", db, 6);
            await db.insert(machines).values({
              id: createId(),
              code: machineCode,
              purchaseItemId: purchaseItem.id,
              status: MachineStatus.NEW,
              cost: it.unitPrice,
              serial: it.quantity === 1 ? it.serial ?? null : null,
              createdById: this.ctx.getUserId() ?? null,
            });
          }
        } else if (it.itemType === PurchaseItemType.COMPONENT) {
          if (!it.categoryCode) {
            throw new BusinessError(
              "COMPONENT_CATEGORY_REQUIRED",
              `Category code required for COMPONENT item: ${it.description}`,
            );
          }
          const categoryRows = await db
            .select()
            .from(componentCategories)
            .where(eq(componentCategories.code, it.categoryCode))
            .limit(1);
          const category = categoryRows[0];
          if (!category) {
            throw new BusinessError(
              "COMPONENT_CATEGORY_NOT_FOUND",
              `Component category ${it.categoryCode} not found`,
            );
          }
          for (let i = 0; i < it.quantity; i++) {
            const compCode = await this.codes.next(category.prefix, db, 6);
            await db.insert(components).values({
              id: createId(),
              code: compCode,
              categoryId: category.id,
              status: ComponentStatus.IN_STOCK,
              costPrice: it.unitPrice,
              createdById: this.ctx.getUserId() ?? null,
              notes: `Purchase item ${purchaseItem.id}`,
            });
          }
        }
      }

      await this.audit.record(
        { action: "purchase.create", entityType: "PurchaseOrder", entityId: order.id, after: order },
        db,
      );

      const result = await db.query.purchaseOrders.findFirst({
        where: eq(purchaseOrders.id, order.id),
        with: { supplier: true, items: { with: { machines: true } } },
      });
      if (!result) throw new NotFoundException({ code: "PURCHASE_NOT_FOUND", message: "Purchase order not found" });
      return result;
    });
  }

  async update(id: string, dto: UpdatePurchaseDto) {
    const beforeRows = await this.dbs.db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, id))
      .limit(1);
    const before = beforeRows[0];
    if (!before) throw new NotFoundException({ code: "PURCHASE_NOT_FOUND", message: "Purchase order not found" });
    if (before.status !== PurchaseOrderStatus.DRAFT) {
      throw new BusinessError(
        "INVALID_STATUS_TRANSITION",
        `Cannot update purchase in status ${before.status}`,
        HttpStatus.CONFLICT,
      );
    }
    return this.dbs.transaction(async (db) => {
      const orderRows = await db
        .update(purchaseOrders)
        .set({
          supplierId: dto.supplierId ?? before.supplierId,
          notes: dto.notes ?? before.notes,
          otherCost: dto.otherCost ?? before.otherCost,
          updatedAt: new Date(),
        })
        .where(eq(purchaseOrders.id, id))
        .returning();
      const order = orderRows[0];
      await this.audit.record(
        { action: "purchase.update", entityType: "PurchaseOrder", entityId: id, before, after: order },
        db,
      );
      return order;
    });
  }

  async updateItem(orderId: string, itemId: string, dto: UpdatePurchaseItemDto) {
    const order = await this.dbs.db.query.purchaseOrders.findFirst({
      where: eq(purchaseOrders.id, orderId),
      with: { items: true },
    });
    if (!order) throw new NotFoundException({ code: "PURCHASE_NOT_FOUND", message: "Purchase order not found" });
    if (order.status !== PurchaseOrderStatus.DRAFT) {
      throw new BusinessError(
        "INVALID_STATUS_TRANSITION",
        `Cannot update items in status ${order.status}`,
        HttpStatus.CONFLICT,
      );
    }
    const before = order.items.find((it) => it.id === itemId);
    if (!before) throw new NotFoundException({ code: "PURCHASE_ITEM_NOT_FOUND", message: "Purchase item not found" });

    return this.dbs.transaction(async (db) => {
      const nextType = dto.itemType ?? before.itemType;
      const nextQty = dto.quantity ?? before.quantity;
      const nextUnitPrice = dto.unitPrice ?? Number(before.unitPrice);
      const nextTotal = Number(nextQty) * Number(nextUnitPrice);
      const nextSerial = dto.serial !== undefined ? dto.serial : before.serial;

      const updatedRows = await db
        .update(purchaseItems)
        .set({
          itemType: nextType,
          description: dto.description ?? before.description,
          model: dto.model !== undefined ? dto.model : before.model,
          serial: nextSerial,
          quantity: nextQty,
          unitPrice: nextUnitPrice,
          totalPrice: nextTotal,
          notes: dto.notes !== undefined ? dto.notes : before.notes,
          updatedAt: new Date(),
        })
        .where(eq(purchaseItems.id, itemId))
        .returning();
      const updated = updatedRows[0];
      if (!updated) throw new NotFoundException({ code: "PURCHASE_ITEM_NOT_FOUND", message: "Purchase item not found" });

      // Xóa Machine/Component cũ và tạo lại theo giá trị mới.
      await db.delete(machines).where(eq(machines.purchaseItemId, itemId));
      await db.delete(components).where(eq(components.notes, `Purchase item ${itemId}`));

      if (nextType === PurchaseItemType.MACHINE) {
        for (let i = 0; i < nextQty; i++) {
          const machineCode = await this.codes.next("PC", db, 6);
          await db.insert(machines).values({
            id: createId(),
            code: machineCode,
            purchaseItemId: itemId,
            status: MachineStatus.NEW,
            cost: nextUnitPrice,
            serial: nextQty === 1 ? nextSerial ?? null : null,
            createdById: this.ctx.getUserId() ?? null,
          });
        }
      } else if (nextType === PurchaseItemType.COMPONENT) {
        const categoryCode = dto.categoryCode;
        if (!categoryCode) {
          throw new BusinessError(
            "COMPONENT_CATEGORY_REQUIRED",
            `Category code required for COMPONENT item: ${updated.description}`,
          );
        }
        const categoryRows = await db
          .select()
          .from(componentCategories)
          .where(eq(componentCategories.code, categoryCode))
          .limit(1);
        const category = categoryRows[0];
        if (!category) {
          throw new BusinessError(
            "COMPONENT_CATEGORY_NOT_FOUND",
            `Component category ${categoryCode} not found`,
          );
        }
        for (let i = 0; i < nextQty; i++) {
          const compCode = await this.codes.next(category.prefix, db, 6);
          await db.insert(components).values({
            id: createId(),
            code: compCode,
            categoryId: category.id,
            status: ComponentStatus.IN_STOCK,
            costPrice: nextUnitPrice,
            createdById: this.ctx.getUserId() ?? null,
            notes: `Purchase item ${itemId}`,
          });
        }
      }

      await this.recalcOrderTotal(db, orderId);

      await this.audit.record(
        {
          action: "purchase.item.update",
          entityType: "PurchaseItem",
          entityId: itemId,
          before,
          after: updated,
        },
        db,
      );
      return updated;
    });
  }

  async deleteItem(orderId: string, itemId: string) {
    const order = await this.dbs.db.query.purchaseOrders.findFirst({
      where: eq(purchaseOrders.id, orderId),
      with: { items: true },
    });
    if (!order) throw new NotFoundException({ code: "PURCHASE_NOT_FOUND", message: "Purchase order not found" });
    if (order.status !== PurchaseOrderStatus.DRAFT) {
      throw new BusinessError(
        "INVALID_STATUS_TRANSITION",
        `Cannot delete items in status ${order.status}`,
        HttpStatus.CONFLICT,
      );
    }
    const before = order.items.find((it) => it.id === itemId);
    if (!before) throw new NotFoundException({ code: "PURCHASE_ITEM_NOT_FOUND", message: "Purchase item not found" });
    if (order.items.length <= 1) {
      throw new BusinessError(
        "PURCHASE_MUST_HAVE_ITEM",
        "Phiếu mua phải có ít nhất 1 mục",
        HttpStatus.CONFLICT,
      );
    }

    return this.dbs.transaction(async (db) => {
      await db.delete(machines).where(eq(machines.purchaseItemId, itemId));
      await db.delete(components).where(eq(components.notes, `Purchase item ${itemId}`));
      const removedRows = await db
        .delete(purchaseItems)
        .where(eq(purchaseItems.id, itemId))
        .returning();
      const removed = removedRows[0];
      if (!removed) throw new NotFoundException({ code: "PURCHASE_ITEM_NOT_FOUND", message: "Purchase item not found" });

      await this.recalcOrderTotal(db, orderId);

      await this.audit.record(
        {
          action: "purchase.item.delete",
          entityType: "PurchaseItem",
          entityId: itemId,
          before,
        },
        db,
      );
      return removed;
    });
  }

  private async recalcOrderTotal(db: DrizzleDb, orderId: string) {
    const order = await db.query.purchaseOrders.findFirst({
      where: eq(purchaseOrders.id, orderId),
      with: { items: true },
    });
    if (!order) throw new NotFoundException({ code: "PURCHASE_NOT_FOUND", message: "Purchase order not found" });
    const itemsTotal = order.items.reduce(
      (s, it) => s + Number(it.totalPrice),
      0,
    );
    const totalAmount = itemsTotal + Number(order.otherCost ?? 0);
    await db
      .update(purchaseOrders)
      .set({ totalAmount, updatedAt: new Date() })
      .where(eq(purchaseOrders.id, orderId));
  }

  async confirm(id: string) {
    const before = await this.dbs.db.query.purchaseOrders.findFirst({
      where: eq(purchaseOrders.id, id),
      with: { items: true },
    });
    if (!before) throw new NotFoundException({ code: "PURCHASE_NOT_FOUND", message: "Purchase order not found" });
    if (before.status !== PurchaseOrderStatus.DRAFT) {
      throw new BusinessError(
        "INVALID_STATUS_TRANSITION",
        `Purchase already ${before.status}`,
        HttpStatus.CONFLICT,
      );
    }

    return this.dbs.transaction(async (db) => {
      const orderRows = await db
        .update(purchaseOrders)
        .set({
          status: PurchaseOrderStatus.CONFIRMED,
          confirmedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(purchaseOrders.id, id))
        .returning();
      const order = orderRows[0];

      // Component items: create one StockTransaction.IN per Component created
      // during draft creation. Machine items remain status=NEW for inspection.
      const componentItems = before.items.filter(
        (it) => it.itemType === PurchaseItemType.COMPONENT,
      );
      for (const it of componentItems) {
        const comps = await db
          .select()
          .from(components)
          .where(eq(components.notes, `Purchase item ${it.id}`));
        for (const c of comps) {
          await this.stock.create(
            {
              componentId: c.id,
              type: StockTxnType.IN,
              reason: "Purchase confirmation",
              refType: "PURCHASE_ITEM",
              refId: it.id,
            },
            db,
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
        db,
      );

      const result = await db.query.purchaseOrders.findFirst({
        where: eq(purchaseOrders.id, id),
        with: { items: { with: { machines: true } }, supplier: true },
      });
      if (!result) throw new NotFoundException({ code: "PURCHASE_NOT_FOUND", message: "Purchase order not found" });
      return result;
    });
  }

  async cancel(id: string) {
    const beforeRows = await this.dbs.db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, id))
      .limit(1);
    const before = beforeRows[0];
    if (!before) throw new NotFoundException({ code: "PURCHASE_NOT_FOUND", message: "Purchase order not found" });
    if (before.status !== PurchaseOrderStatus.DRAFT) {
      throw new BusinessError(
        "INVALID_STATUS_TRANSITION",
        `Cannot cancel purchase in status ${before.status}`,
        HttpStatus.CONFLICT,
      );
    }
    return this.dbs.transaction(async (db) => {
      const orderRows = await db
        .update(purchaseOrders)
        .set({
          status: PurchaseOrderStatus.CANCELLED,
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(purchaseOrders.id, id))
        .returning();
      const order = orderRows[0];
      await this.audit.record(
        { action: "purchase.cancel", entityType: "PurchaseOrder", entityId: id, before, after: order },
        db,
      );
      return order;
    });
  }
}
