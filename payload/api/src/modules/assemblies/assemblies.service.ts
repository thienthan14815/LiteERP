import { HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import {
  AssemblyStatus,
  ComponentStatus,
  FinishedPcStatus,
  StockTxnType,
} from "@app/shared";
import { and, desc, eq, gte, inArray, like, lte, sql, type SQL } from "drizzle-orm";
import { DbService, DrizzleDb } from "../../database/db.service";
import {
  assemblyOrders,
  assemblyItems,
  finishedPcs,
  finishedPcComponents,
  components as componentsTable,
} from "../../database/schema";
import { createId } from "../../database/id";
import { CodeGeneratorService } from "../../common/utils/code-generator.service";
import { AuditLogService } from "../audit-logs/audit-logs.service";
import { StockTransactionService } from "../inventory/stock-transaction.service";
import { BusinessError } from "../../common/exceptions/business.exception";
import { RequestContextService } from "../../common/context/request-context.service";
import { buildPagination, paginate } from "../../common/utils/pagination.util";
import { CreateAssemblyDto, AssemblyRole } from "./dto/create-assembly.dto";
import { UpdateAssemblyDto } from "./dto/update-assembly.dto";
import { QueryAssemblyDto } from "./dto/query-assembly.dto";

// AssemblyItem has no role column; role is inferred from Component.category.

@Injectable()
export class AssembliesService {
  constructor(
    private readonly dbs: DbService,
    private readonly codes: CodeGeneratorService,
    private readonly audit: AuditLogService,
    private readonly stock: StockTransactionService,
    private readonly ctx: RequestContextService,
  ) {}

  async list(q: QueryAssemblyDto) {
    const conds: SQL[] = [];
    if (q.status) conds.push(eq(assemblyOrders.status, q.status));
    if (q.fromDate) conds.push(gte(assemblyOrders.createdAt, new Date(q.fromDate)));
    if (q.toDate) conds.push(lte(assemblyOrders.createdAt, new Date(q.toDate)));
    if (q.search) conds.push(like(assemblyOrders.code, `%${q.search}%`));
    const where = conds.length ? and(...conds) : undefined;
    const { take, skip } = buildPagination(q.page, q.pageSize);
    const db = this.dbs.db;
    const items = await db.query.assemblyOrders.findMany({
      where,
      with: {
        finishedPcs: { columns: { id: true, code: true, status: true } },
      },
      orderBy: [desc(assemblyOrders.createdAt)],
      limit: take,
      offset: skip,
    });
    const totalRows = await db
      .select({ count: sql<number>`count(*)`.as("count") })
      .from(assemblyOrders)
      .where(where);
    const total = Number(totalRows[0]?.count ?? 0);
    // _count.items emulation: one grouped count over the page's order ids.
    const ids = items.map((a) => a.id);
    const counts = ids.length
      ? await db
          .select({
            refId: assemblyItems.assemblyOrderId,
            count: sql<number>`count(*)`.as("count"),
          })
          .from(assemblyItems)
          .where(inArray(assemblyItems.assemblyOrderId, ids))
          .groupBy(assemblyItems.assemblyOrderId)
      : [];
    const countMap = new Map(counts.map((c) => [c.refId, Number(c.count)]));
    const projected = items.map((a) => ({
      ...a,
      itemCount: countMap.get(a.id) ?? 0,
      totalCost:
        Number(a.repairCost) + Number(a.cleaningCost) + Number(a.assemblyCost),
    }));
    return paginate(projected, total, q.page ?? 1, q.pageSize ?? 20);
  }

  async get(id: string, db?: DrizzleDb) {
    const client = db ?? this.dbs.db;
    const item = await client.query.assemblyOrders.findFirst({
      where: eq(assemblyOrders.id, id),
      with: {
        items: {
          with: {
            component: {
              with: { category: true },
            },
          },
        },
        finishedPcs: { columns: { id: true, code: true, status: true, costPrice: true } },
      },
    });
    if (!item) {
      throw new NotFoundException({ code: "ASSEMBLY_NOT_FOUND", message: "Assembly order not found" });
    }

    const components = item.items.map((it) => ({
      id: it.id,
      componentId: it.componentId,
      role: this.guessRole(it.component.category.code),
      unitCost: Number(it.unitCost),
      component: {
        id: it.component.id,
        code: it.component.code,
        categoryCode: it.component.category.code,
        model: it.component.model,
        serial: it.component.serialNumber,
        status: it.component.status,
        costPrice: Number(it.component.costPrice),
      },
    }));
    const componentsTotal = components.reduce((s, c) => s + c.unitCost, 0);
    const totalCost =
      componentsTotal + Number(item.repairCost) + Number(item.cleaningCost) + Number(item.assemblyCost);

    return {
      ...item,
      components,
      componentsTotal,
      totalCost,
      draftPcPreview: {
        costPrice: totalCost,
      },
    };
  }

  private guessRole(categoryCode: string): AssemblyRole {
    const r = categoryCode as keyof typeof AssemblyRole;
    if (AssemblyRole[r]) return AssemblyRole[r];
    return AssemblyRole.OTHER;
  }

  async create(dto: CreateAssemblyDto) {
    const componentIds = dto.items.map((i) => i.componentId);
    const dups = componentIds.filter((id, i) => componentIds.indexOf(id) !== i);
    if (dups.length > 0) {
      throw new BusinessError(
        "DUPLICATE_COMPONENT",
        `Duplicate componentId in items: ${dups[0]}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.dbs.transaction(async (db) => {
      const components = componentIds.length
        ? await db
            .select()
            .from(componentsTable)
            .where(inArray(componentsTable.id, componentIds))
        : [];
      if (components.length !== componentIds.length) {
        throw new BusinessError(
          "COMPONENT_NOT_FOUND",
          "One or more components not found",
          HttpStatus.NOT_FOUND,
        );
      }
      for (const c of components) {
        if (c.status !== ComponentStatus.IN_STOCK) {
          throw new BusinessError(
            "COMPONENT_NOT_AVAILABLE",
            `Component ${c.code} is ${c.status}, must be IN_STOCK`,
            HttpStatus.CONFLICT,
          );
        }
      }

      const code = await this.codes.next("AO", db, 6);
      const orderRows = await db
        .insert(assemblyOrders)
        .values({
          id: createId(),
          code,
          status: AssemblyStatus.DRAFT,
          repairCost: dto.repairCost ?? 0,
          cleaningCost: dto.cleaningCost ?? 0,
          assemblyCost: dto.assemblyCost ?? 0,
          notes: this.composeNotes(dto.name, dto.notes),
          createdById: this.ctx.getUserId() ?? null,
        })
        .returning();
      const order = orderRows[0];

      const componentById = new Map(components.map((c) => [c.id, c]));
      for (const it of dto.items) {
        const c = componentById.get(it.componentId)!;
        await db.insert(assemblyItems).values({
          id: createId(),
          assemblyOrderId: order.id,
          componentId: it.componentId,
          unitCost: c.costPrice,
        });
        const reserved = await this.stock.reserveAtomic(
          it.componentId,
          "ASSEMBLY_ORDER",
          order.id,
          db,
        );
        if (!reserved) {
          throw new BusinessError(
            "COMPONENT_NOT_AVAILABLE",
            `Linh kien ${c.code} khong con kha dung`,
            HttpStatus.CONFLICT,
          );
        }
      }

      await this.audit.record(
        { action: "assembly.create", entityType: "AssemblyOrder", entityId: order.id, after: order },
        db,
      );

      return this.get(order.id, db);
    });
  }

  private composeNotes(name?: string, notes?: string): string | null {
    const parts: string[] = [];
    if (name) parts.push(`NAME:${name}`);
    if (notes) parts.push(notes);
    return parts.length > 0 ? parts.join("\n") : null;
  }

  async update(id: string, dto: UpdateAssemblyDto) {
    const before = await this.dbs.db.query.assemblyOrders.findFirst({
      where: eq(assemblyOrders.id, id),
      with: { items: true },
    });
    if (!before) {
      throw new NotFoundException({ code: "ASSEMBLY_NOT_FOUND", message: "Assembly order not found" });
    }
    if (
      before.status !== AssemblyStatus.DRAFT &&
      before.status !== AssemblyStatus.IN_PROGRESS
    ) {
      throw new BusinessError(
        "INVALID_STATUS_TRANSITION",
        `Cannot update assembly in status ${before.status}`,
        HttpStatus.CONFLICT,
      );
    }

    return this.dbs.transaction(async (db) => {
      if (dto.items) {
        const newIds = dto.items.map((i) => i.componentId);
        const dups = newIds.filter((x, i) => newIds.indexOf(x) !== i);
        if (dups.length > 0) {
          throw new BusinessError(
            "DUPLICATE_COMPONENT",
            `Duplicate componentId: ${dups[0]}`,
            HttpStatus.BAD_REQUEST,
          );
        }
        const oldIds = before.items.map((i) => i.componentId);
        const toRelease = oldIds.filter((id) => !newIds.includes(id));
        const toReserve = newIds.filter((id) => !oldIds.includes(id));

        const reserveComponents = toReserve.length
          ? await db
              .select()
              .from(componentsTable)
              .where(inArray(componentsTable.id, toReserve))
          : [];
        for (const c of reserveComponents) {
          if (c.status !== ComponentStatus.IN_STOCK) {
            throw new BusinessError(
              "COMPONENT_NOT_AVAILABLE",
              `Component ${c.code} is ${c.status}, must be IN_STOCK`,
              HttpStatus.CONFLICT,
            );
          }
        }

        for (const cid of toRelease) {
          await this.stock.releaseReservation(
            cid,
            "ASSEMBLY_ORDER",
            id,
            "Removed from assembly draft",
            db,
          );
        }
        for (const cid of toReserve) {
          const reserved = await this.stock.reserveAtomic(cid, "ASSEMBLY_ORDER", id, db);
          if (!reserved) {
            throw new BusinessError(
              "COMPONENT_NOT_AVAILABLE",
              `Linh kien ${cid} khong con kha dung`,
              HttpStatus.CONFLICT,
            );
          }
        }

        if (toRelease.length) {
          await db
            .delete(assemblyItems)
            .where(
              and(
                eq(assemblyItems.assemblyOrderId, id),
                inArray(assemblyItems.componentId, toRelease),
              ),
            );
        }
        const reserveById = new Map(reserveComponents.map((c) => [c.id, c]));
        for (const newId of toReserve) {
          const c = reserveById.get(newId)!;
          await db.insert(assemblyItems).values({
            id: createId(),
            assemblyOrderId: id,
            componentId: newId,
            unitCost: c.costPrice,
          });
        }
      }

      const name = dto.name ?? this.extractName(before.notes);
      const rawNotes = dto.notes ?? this.extractNotes(before.notes);
      const afterRows = await db
        .update(assemblyOrders)
        .set({
          repairCost: dto.repairCost ?? before.repairCost,
          cleaningCost: dto.cleaningCost ?? before.cleaningCost,
          assemblyCost: dto.assemblyCost ?? before.assemblyCost,
          notes: this.composeNotes(name, rawNotes),
          updatedAt: new Date(),
        })
        .where(eq(assemblyOrders.id, id))
        .returning();
      const after = afterRows[0];

      await this.audit.record(
        { action: "assembly.update", entityType: "AssemblyOrder", entityId: id, before, after },
        db,
      );

      return this.get(id, db);
    });
  }

  private extractName(notes: string | null | undefined): string | undefined {
    if (!notes) return undefined;
    const m = notes.match(/^NAME:(.+)$/m);
    return m?.[1];
  }
  private extractNotes(notes: string | null | undefined): string | undefined {
    if (!notes) return undefined;
    return notes
      .split("\n")
      .filter((l) => !l.startsWith("NAME:"))
      .join("\n") || undefined;
  }

  async start(id: string) {
    const beforeRows = await this.dbs.db
      .select()
      .from(assemblyOrders)
      .where(eq(assemblyOrders.id, id))
      .limit(1);
    const before = beforeRows[0];
    if (!before) {
      throw new NotFoundException({ code: "ASSEMBLY_NOT_FOUND", message: "Assembly order not found" });
    }
    if (before.status !== AssemblyStatus.DRAFT) {
      throw new BusinessError(
        "INVALID_STATUS_TRANSITION",
        `Assembly already ${before.status}`,
        HttpStatus.CONFLICT,
      );
    }
    return this.dbs.transaction(async (db) => {
      const afterRows = await db
        .update(assemblyOrders)
        .set({ status: AssemblyStatus.IN_PROGRESS, startedAt: new Date(), updatedAt: new Date() })
        .where(eq(assemblyOrders.id, id))
        .returning();
      const after = afterRows[0];
      await this.audit.record(
        { action: "assembly.start", entityType: "AssemblyOrder", entityId: id, before, after },
        db,
      );
      return this.get(id, db);
    });
  }

  async complete(id: string) {
    const before = await this.dbs.db.query.assemblyOrders.findFirst({
      where: eq(assemblyOrders.id, id),
      with: {
        items: { with: { component: { with: { category: true } } } },
      },
    });
    if (!before) {
      throw new NotFoundException({ code: "ASSEMBLY_NOT_FOUND", message: "Assembly order not found" });
    }
    if (before.status !== AssemblyStatus.IN_PROGRESS) {
      throw new BusinessError(
        "INVALID_STATUS_TRANSITION",
        `Cannot complete assembly in status ${before.status}`,
        HttpStatus.CONFLICT,
      );
    }
    const categoryCodes = before.items.map((i) => i.component.category.code);
    if (!categoryCodes.includes("CPU")) {
      throw new BusinessError(
        "MISSING_REQUIRED_COMPONENT",
        "Assembly must include at least one CPU",
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!categoryCodes.includes("MB")) {
      throw new BusinessError(
        "MISSING_REQUIRED_COMPONENT",
        "Assembly must include at least one MB (mainboard)",
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.dbs.transaction(async (db) => {
      const componentsCostTotal = before.items.reduce(
        (s, it) => s + Number(it.component.costPrice),
        0,
      );
      const costPrice =
        componentsCostTotal +
        Number(before.repairCost) +
        Number(before.cleaningCost) +
        Number(before.assemblyCost);

      const pcCode = await this.codes.next("PC", db, 6);
      const pcRows = await db
        .insert(finishedPcs)
        .values({
          id: createId(),
          code: pcCode,
          assemblyOrderId: before.id,
          // Hoàn thành phiếu lắp ráp = máy sẵn sàng lên kệ (READY_FOR_SALE).
          // User có thể transition ngược về TESTING nếu cần retest.
          status: FinishedPcStatus.READY_FOR_SALE,
          costPrice,
          suggestedPrice: 0,
          createdById: this.ctx.getUserId() ?? null,
        })
        .returning();
      const pc = pcRows[0];

      for (const it of before.items) {
        await db.insert(finishedPcComponents).values({
          id: createId(),
          finishedPcId: pc.id,
          componentId: it.componentId,
          installedAt: new Date(),
        });
        await this.stock.create(
          {
            componentId: it.componentId,
            type: StockTxnType.OUT,
            reason: `Assembled into ${pcCode}`,
            refType: "ASSEMBLY_ORDER",
            refId: before.id,
            newComponentStatus: ComponentStatus.ASSEMBLED,
          },
          db,
        );
        await db
          .update(componentsTable)
          .set({ currentFinishedPcId: pc.id, updatedAt: new Date() })
          .where(eq(componentsTable.id, it.componentId));
      }

      const afterRows = await db
        .update(assemblyOrders)
        .set({ status: AssemblyStatus.COMPLETED, completedAt: new Date(), updatedAt: new Date() })
        .where(eq(assemblyOrders.id, id))
        .returning();
      const after = afterRows[0];

      await this.audit.record(
        {
          action: "assembly.complete",
          entityType: "AssemblyOrder",
          entityId: id,
          before,
          after: { ...after, finishedPcId: pc.id, finishedPcCode: pc.code, costPrice },
        },
        db,
      );

      return this.get(id, db);
    });
  }

  async cancel(id: string) {
    const before = await this.dbs.db.query.assemblyOrders.findFirst({
      where: eq(assemblyOrders.id, id),
      with: { items: true },
    });
    if (!before) {
      throw new NotFoundException({ code: "ASSEMBLY_NOT_FOUND", message: "Assembly order not found" });
    }
    if (
      before.status !== AssemblyStatus.DRAFT &&
      before.status !== AssemblyStatus.IN_PROGRESS
    ) {
      throw new BusinessError(
        "INVALID_STATUS_TRANSITION",
        `Cannot cancel assembly in status ${before.status}`,
        HttpStatus.CONFLICT,
      );
    }
    return this.dbs.transaction(async (db) => {
      for (const it of before.items) {
        await this.stock.releaseReservation(
          it.componentId,
          "ASSEMBLY_ORDER",
          id,
          "Assembly cancelled",
          db,
        );
      }
      const afterRows = await db
        .update(assemblyOrders)
        .set({ status: AssemblyStatus.CANCELLED, updatedAt: new Date() })
        .where(eq(assemblyOrders.id, id))
        .returning();
      const after = afterRows[0];
      await this.audit.record(
        { action: "assembly.cancel", entityType: "AssemblyOrder", entityId: id, before, after },
        db,
      );
      return this.get(id, db);
    });
  }
}
