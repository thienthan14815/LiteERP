import { HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, desc, eq, gte, inArray, isNull, like, lte, or, sql, type SQL } from "drizzle-orm";
import {
  ComponentStatus,
  FinishedPcStatus,
  StockTxnType,
  WarrantyStatus,
} from "@app/shared";
import { DbService, DrizzleDb } from "../../database/db.service";
import {
  auditLogs,
  components,
  customers,
  finishedPcComponents,
  finishedPcs,
  warrantyCases,
  warrantyItems,
} from "../../database/schema";
import { createId } from "../../database/id";
import { CodeGeneratorService } from "../../common/utils/code-generator.service";
import { AuditLogService } from "../audit-logs/audit-logs.service";
import { StockTransactionService } from "../inventory/stock-transaction.service";
import { BusinessError } from "../../common/exceptions/business.exception";
import { RequestContextService } from "../../common/context/request-context.service";
import { buildPagination, paginate } from "../../common/utils/pagination.util";
import { CreateWarrantyDto } from "./dto/create-warranty.dto";
import { QueryWarrantyDto } from "./dto/query-warranty.dto";
import { TransitionWarrantyDto, WARRANTY_TRANSITIONS } from "./dto/transition-warranty.dto";
import { ReplaceComponentDto } from "./dto/replace-component.dto";

// Persisted in WarrantyCase.resolution as a JSON blob so we can reverse status on
// COMPLETED / REJECTED without a schema migration. Shape:
//   { originalStatus: { finishedPc?: FinishedPcStatus, component?: ComponentStatus },
//     componentId?: string, salesOrderId?: string, freeform?: string }
export interface WarrantyMeta {
  originalStatus?: {
    finishedPc?: FinishedPcStatus;
    component?: ComponentStatus;
  };
  componentId?: string;
  salesOrderId?: string;
  freeform?: string;
}

function parseMeta(raw: string | null | undefined): WarrantyMeta {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    if (v && typeof v === "object") return v as WarrantyMeta;
    return { freeform: raw };
  } catch {
    return { freeform: raw };
  }
}

function stringifyMeta(meta: WarrantyMeta): string {
  return JSON.stringify(meta);
}

@Injectable()
export class WarrantiesService {
  constructor(
    private readonly dbs: DbService,
    private readonly codes: CodeGeneratorService,
    private readonly audit: AuditLogService,
    private readonly stock: StockTransactionService,
    private readonly ctx: RequestContextService,
  ) {}

  async list(q: QueryWarrantyDto) {
    const db = this.dbs.db;
    const conds: SQL[] = [];
    if (q.status) conds.push(eq(warrantyCases.status, q.status));
    if (q.customerId) conds.push(eq(warrantyCases.customerId, q.customerId));
    if (q.fromDate) conds.push(gte(warrantyCases.createdAt, new Date(q.fromDate)));
    if (q.toDate) conds.push(lte(warrantyCases.createdAt, new Date(q.toDate)));
    if (q.search) {
      const term = `%${q.search}%`;
      const searchCond = or(
        like(warrantyCases.code, term),
        // finishedPc: { code: { contains } } → sub-select on finished_pcs
        inArray(
          warrantyCases.finishedPcId,
          db.select({ id: finishedPcs.id }).from(finishedPcs).where(like(finishedPcs.code, term)),
        ),
        // items: { some: { OR: [...] } } → sub-select on warranty_items whose
        // removed/replacement component matches the search term
        inArray(
          warrantyCases.id,
          db
            .select({ id: warrantyItems.warrantyCaseId })
            .from(warrantyItems)
            .where(
              or(
                inArray(
                  warrantyItems.removedComponentId,
                  db
                    .select({ id: components.id })
                    .from(components)
                    .where(or(like(components.code, term), like(components.serialNumber, term))),
                ),
                inArray(
                  warrantyItems.replacementComponentId,
                  db.select({ id: components.id }).from(components).where(like(components.code, term)),
                ),
              ),
            ),
        ),
      );
      if (searchCond) conds.push(searchCond);
    }
    const where = conds.length ? and(...conds) : undefined;
    const { take, skip } = buildPagination(q.page, q.pageSize);
    const items = await db.query.warrantyCases.findMany({
      where,
      with: {
        customer: { columns: { id: true, name: true, phone: true } },
        finishedPc: { columns: { id: true, code: true, status: true } },
      },
      orderBy: [desc(warrantyCases.createdAt)],
      limit: take,
      offset: skip,
    });
    const totalRows = await db
      .select({ count: sql<number>`count(*)`.as("count") })
      .from(warrantyCases)
      .where(where);
    const total = Number(totalRows[0]?.count ?? 0);
    // _count: { items } emulation — one grouped query for the whole page.
    const ids = items.map((w) => w.id);
    const counts = ids.length
      ? await db
          .select({
            refId: warrantyItems.warrantyCaseId,
            count: sql<number>`count(*)`.as("count"),
          })
          .from(warrantyItems)
          .where(inArray(warrantyItems.warrantyCaseId, ids))
          .groupBy(warrantyItems.warrantyCaseId)
      : [];
    const countMap = new Map(counts.map((c) => [c.refId, Number(c.count)]));
    const withCounts = items.map((w) => ({ ...w, _count: { items: countMap.get(w.id) ?? 0 } }));
    return paginate(withCounts, total, q.page ?? 1, q.pageSize ?? 20);
  }

  async get(id: string) {
    const db = this.dbs.db;
    const item = await db.query.warrantyCases.findFirst({
      where: eq(warrantyCases.id, id),
      with: {
        customer: true,
        finishedPc: { columns: { id: true, code: true, status: true } },
        items: {
          with: {
            removedComponent: {
              columns: { id: true, code: true, serialNumber: true, model: true },
              with: { category: { columns: { code: true } } },
            },
            replacementComponent: {
              columns: { id: true, code: true, serialNumber: true, model: true },
              with: { category: { columns: { code: true } } },
            },
          },
          orderBy: (wi, ops) => [ops.asc(wi.createdAt)],
        },
      },
    });
    if (!item) {
      throw new NotFoundException({
        code: "WARRANTY_NOT_FOUND",
        message: "Warranty case not found",
      });
    }
    const meta = parseMeta(item.resolution);
    const timeline = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        createdAt: auditLogs.createdAt,
        actorUserId: auditLogs.actorUserId,
        beforeJson: auditLogs.beforeJson,
        afterJson: auditLogs.afterJson,
      })
      .from(auditLogs)
      .where(and(eq(auditLogs.entityType, "WarrantyCase"), eq(auditLogs.entityId, id)))
      .orderBy(asc(auditLogs.createdAt));
    let relatedComponent = null as null | { id: string; code: string; serialNumber: string | null; status: string };
    if (meta.componentId) {
      const c = (
        await db
          .select({
            id: components.id,
            code: components.code,
            serialNumber: components.serialNumber,
            status: components.status,
          })
          .from(components)
          .where(eq(components.id, meta.componentId))
          .limit(1)
      )[0];
      relatedComponent = c ?? null;
    }
    return {
      ...item,
      meta,
      relatedComponent,
      timeline,
    };
  }

  async create(dto: CreateWarrantyDto) {
    if (!dto.finishedPcId && !dto.componentId) {
      throw new BusinessError(
        "WARRANTY_TARGET_REQUIRED",
        "Either finishedPcId or componentId is required",
        HttpStatus.BAD_REQUEST,
      );
    }
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

      const ACTIVE_STATUSES = [
        WarrantyStatus.RECEIVED,
        WarrantyStatus.INSPECTING,
        WarrantyStatus.REPAIRING,
        WarrantyStatus.REPLACED,
      ];

      if (dto.finishedPcId) {
        const existing = (
          await db
            .select()
            .from(warrantyCases)
            .where(
              and(
                eq(warrantyCases.finishedPcId, dto.finishedPcId),
                inArray(warrantyCases.status, ACTIVE_STATUSES),
              ),
            )
            .limit(1)
        )[0];
        if (existing) {
          throw new BusinessError(
            "WARRANTY_ALREADY_OPEN",
            `Đã có phiếu bảo hành đang xử lý (${existing.code}) cho máy này`,
            HttpStatus.CONFLICT,
          );
        }
      }

      if (dto.componentId) {
        const existing = (
          await db
            .select()
            .from(warrantyCases)
            .where(
              and(
                inArray(warrantyCases.status, ACTIVE_STATUSES),
                // items: { some: { removedComponentId } } → sub-select on warranty_items
                inArray(
                  warrantyCases.id,
                  db
                    .select({ id: warrantyItems.warrantyCaseId })
                    .from(warrantyItems)
                    .where(eq(warrantyItems.removedComponentId, dto.componentId)),
                ),
              ),
            )
            .limit(1)
        )[0];
        if (existing) {
          throw new BusinessError(
            "WARRANTY_ALREADY_OPEN",
            `Đã có phiếu bảo hành đang xử lý (${existing.code}) cho linh kiện này`,
            HttpStatus.CONFLICT,
          );
        }
      }

      const meta: WarrantyMeta = { originalStatus: {} };
      if (dto.salesOrderId) meta.salesOrderId = dto.salesOrderId;
      if (dto.notes) meta.freeform = dto.notes;

      let pc = null as null | { id: string; code: string; status: string };
      if (dto.finishedPcId) {
        const found = (
          await db
            .select({ id: finishedPcs.id, code: finishedPcs.code, status: finishedPcs.status })
            .from(finishedPcs)
            .where(eq(finishedPcs.id, dto.finishedPcId))
            .limit(1)
        )[0];
        if (!found) {
          throw new BusinessError(
            "FINISHED_PC_NOT_FOUND",
            `Finished PC ${dto.finishedPcId} not found`,
            HttpStatus.NOT_FOUND,
          );
        }
        if (found.status !== FinishedPcStatus.SOLD && found.status !== FinishedPcStatus.WARRANTY) {
          throw new BusinessError(
            "FINISHED_PC_NOT_WARRANTABLE",
            `Finished PC ${found.code} is ${found.status}; must be SOLD or WARRANTY`,
            HttpStatus.CONFLICT,
          );
        }
        meta.originalStatus!.finishedPc = found.status as FinishedPcStatus;
        pc = found;
      }

      let comp = null as null | { id: string; code: string; status: string };
      if (dto.componentId) {
        const found = (
          await db
            .select({ id: components.id, code: components.code, status: components.status })
            .from(components)
            .where(eq(components.id, dto.componentId))
            .limit(1)
        )[0];
        if (!found) {
          throw new BusinessError(
            "COMPONENT_NOT_FOUND",
            `Component ${dto.componentId} not found`,
            HttpStatus.NOT_FOUND,
          );
        }
        if (found.status !== ComponentStatus.SOLD && found.status !== ComponentStatus.WARRANTY) {
          throw new BusinessError(
            "COMPONENT_NOT_WARRANTABLE",
            `Component ${found.code} is ${found.status}; must be SOLD or WARRANTY`,
            HttpStatus.CONFLICT,
          );
        }
        meta.originalStatus!.component = found.status as ComponentStatus;
        meta.componentId = found.id;
        comp = found;
      }

      const code = await this.codes.next("WC", db, 6);
      const created = (
        await db
          .insert(warrantyCases)
          .values({
            id: createId(),
            code,
            customerId: dto.customerId,
            finishedPcId: pc?.id ?? null,
            status: WarrantyStatus.RECEIVED,
            description: dto.issue,
            receivedAt: dto.receivedAt ? new Date(dto.receivedAt) : new Date(),
            resolution: stringifyMeta(meta),
            createdById: this.ctx.getUserId() ?? null,
          })
          .returning()
      )[0];

      if (pc && pc.status !== FinishedPcStatus.WARRANTY) {
        await db
          .update(finishedPcs)
          .set({ status: FinishedPcStatus.WARRANTY, updatedAt: new Date() })
          .where(eq(finishedPcs.id, pc.id));
      }
      if (comp && comp.status !== ComponentStatus.WARRANTY) {
        await this.stock.create(
          {
            componentId: comp.id,
            type: StockTxnType.ADJUSTMENT,
            reason: `Warranty case ${code} opened`,
            refType: "WARRANTY_CASE",
            refId: created.id,
            newComponentStatus: ComponentStatus.WARRANTY,
          },
          db,
        );
      }

      await this.audit.record(
        {
          action: "warranty.create",
          entityType: "WarrantyCase",
          entityId: created.id,
          after: created,
        },
        db,
      );
      return created;
    });
  }

  async transition(id: string, dto: TransitionWarrantyDto) {
    const before = (
      await this.dbs.db.select().from(warrantyCases).where(eq(warrantyCases.id, id)).limit(1)
    )[0];
    if (!before) {
      throw new NotFoundException({ code: "WARRANTY_NOT_FOUND", message: "Warranty case not found" });
    }
    const allowed = WARRANTY_TRANSITIONS[before.status] ?? [];
    // before.status is `string` (SQLite); WARRANTY_TRANSITIONS is now keyed by string.
    if (!allowed.includes(dto.to)) {
      throw new BusinessError(
        "INVALID_STATUS_TRANSITION",
        `Cannot transition ${before.status} -> ${dto.to}`,
        HttpStatus.CONFLICT,
      );
    }
    const isTerminal = dto.to === WarrantyStatus.COMPLETED || dto.to === WarrantyStatus.REJECTED;
    return this.dbs.transaction(async (db) => {
      const meta = parseMeta(before.resolution);
      if (dto.notes) {
        meta.freeform = meta.freeform ? `${meta.freeform}\n${dto.notes}` : dto.notes;
      }
      const after = (
        await db
          .update(warrantyCases)
          .set({
            status: dto.to,
            resolution: stringifyMeta(meta),
            completedAt: isTerminal ? new Date() : before.completedAt,
            updatedAt: new Date(),
          })
          .where(eq(warrantyCases.id, id))
          .returning()
      )[0];
      if (isTerminal) {
        await this.revertRelatedEntities(db, before.id, before.finishedPcId, meta);
      }
      await this.audit.record(
        {
          action: "warranty.status",
          entityType: "WarrantyCase",
          entityId: id,
          before,
          after,
        },
        db,
      );
      return after;
    });
  }

  async cancel(id: string) {
    const before = (
      await this.dbs.db.select().from(warrantyCases).where(eq(warrantyCases.id, id)).limit(1)
    )[0];
    if (!before) {
      throw new NotFoundException({ code: "WARRANTY_NOT_FOUND", message: "Warranty case not found" });
    }
    if (before.status !== WarrantyStatus.RECEIVED) {
      throw new BusinessError(
        "INVALID_STATUS_TRANSITION",
        `Cannot cancel warranty in status ${before.status}`,
        HttpStatus.CONFLICT,
      );
    }
    return this.dbs.transaction(async (db) => {
      const meta = parseMeta(before.resolution);
      const after = (
        await db
          .update(warrantyCases)
          .set({ status: WarrantyStatus.REJECTED, completedAt: new Date(), updatedAt: new Date() })
          .where(eq(warrantyCases.id, id))
          .returning()
      )[0];
      await this.revertRelatedEntities(db, before.id, before.finishedPcId, meta);
      await this.audit.record(
        {
          action: "warranty.cancel",
          entityType: "WarrantyCase",
          entityId: id,
          before,
          after,
        },
        db,
      );
      return after;
    });
  }

  private async revertRelatedEntities(
    db: DrizzleDb,
    warrantyCaseId: string,
    finishedPcId: string | null,
    meta: WarrantyMeta,
  ) {
    if (finishedPcId) {
      const target = meta.originalStatus?.finishedPc ?? FinishedPcStatus.SOLD;
      await db
        .update(finishedPcs)
        .set({ status: target, updatedAt: new Date() })
        .where(and(eq(finishedPcs.id, finishedPcId), eq(finishedPcs.status, FinishedPcStatus.WARRANTY)));
    }
    if (meta.componentId) {
      const target = meta.originalStatus?.component ?? ComponentStatus.SOLD;
      const c = (
        await db.select().from(components).where(eq(components.id, meta.componentId)).limit(1)
      )[0];
      if (c && c.status === ComponentStatus.WARRANTY) {
        await this.stock.create(
          {
            componentId: c.id,
            type: StockTxnType.ADJUSTMENT,
            reason: `Warranty case ${warrantyCaseId} closed`,
            refType: "WARRANTY_CASE",
            refId: warrantyCaseId,
            newComponentStatus: target,
          },
          db,
        );
      }
    }
  }

  async replaceComponent(id: string, dto: ReplaceComponentDto) {
    const wc = (
      await this.dbs.db.select().from(warrantyCases).where(eq(warrantyCases.id, id)).limit(1)
    )[0];
    if (!wc) {
      throw new NotFoundException({ code: "WARRANTY_NOT_FOUND", message: "Warranty case not found" });
    }
    if (wc.status === WarrantyStatus.COMPLETED || wc.status === WarrantyStatus.REJECTED) {
      throw new BusinessError(
        "INVALID_STATUS",
        `Cannot replace component on warranty in status ${wc.status}`,
        HttpStatus.CONFLICT,
      );
    }
    if (!wc.finishedPcId) {
      throw new BusinessError(
        "FINISHED_PC_REQUIRED",
        "Component replacement requires a finished PC on the warranty case",
        HttpStatus.CONFLICT,
      );
    }
    if (dto.removedComponentId === dto.replacementComponentId) {
      throw new BusinessError(
        "INVALID_REPLACEMENT",
        "Replacement and removed components must differ",
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.dbs.transaction(async (db) => {
      const link = (
        await db
          .select()
          .from(finishedPcComponents)
          .where(
            and(
              eq(finishedPcComponents.finishedPcId, wc.finishedPcId!),
              eq(finishedPcComponents.componentId, dto.removedComponentId),
              isNull(finishedPcComponents.removedAt),
            ),
          )
          .limit(1)
      )[0];
      if (!link) {
        throw new BusinessError(
          "COMPONENT_NOT_INSTALLED",
          "Removed component is not currently installed on this finished PC",
          HttpStatus.CONFLICT,
        );
      }
      const removed = (
        await db
          .select({
            id: components.id,
            code: components.code,
            status: components.status,
            categoryId: components.categoryId,
            currentFinishedPcId: components.currentFinishedPcId,
          })
          .from(components)
          .where(eq(components.id, dto.removedComponentId))
          .limit(1)
      )[0];
      const replacement = (
        await db
          .select({
            id: components.id,
            code: components.code,
            status: components.status,
            categoryId: components.categoryId,
            costPrice: components.costPrice,
            currentFinishedPcId: components.currentFinishedPcId,
          })
          .from(components)
          .where(eq(components.id, dto.replacementComponentId))
          .limit(1)
      )[0];
      if (!removed || !replacement) {
        throw new BusinessError(
          "COMPONENT_NOT_FOUND",
          "Component not found",
          HttpStatus.NOT_FOUND,
        );
      }
      if (replacement.status !== ComponentStatus.IN_STOCK) {
        throw new BusinessError(
          "REPLACEMENT_NOT_AVAILABLE",
          `Replacement component ${replacement.code} is ${replacement.status}, must be IN_STOCK`,
          HttpStatus.CONFLICT,
        );
      }
      if (replacement.categoryId !== removed.categoryId) {
        throw new BusinessError(
          "INCOMPATIBLE_CATEGORY",
          "Replacement category does not match removed component",
          HttpStatus.CONFLICT,
        );
      }

      const before = {
        link: { id: link.id, installedAt: link.installedAt, removedAt: link.removedAt },
        removedComponent: {
          id: removed.id,
          code: removed.code,
          status: removed.status,
          currentFinishedPcId: removed.currentFinishedPcId,
        },
        replacementComponent: {
          id: replacement.id,
          code: replacement.code,
          status: replacement.status,
          currentFinishedPcId: replacement.currentFinishedPcId,
        },
      };

      // Mark removed component as DEFECTIVE (broken from the customer PC).
      await this.stock.create(
        {
          componentId: removed.id,
          type: StockTxnType.IN,
          reason: `Warranty ${wc.code}: removed from PC`,
          refType: "WARRANTY_CASE",
          refId: wc.id,
          newComponentStatus: ComponentStatus.DEFECTIVE,
        },
        db,
      );
      // Pull replacement OUT of stock, send to customer's PC. Mirror semantics of
      // a sale: ASSEMBLED (installed) then SOLD because the warranty PC is SOLD.
      await this.stock.create(
        {
          componentId: replacement.id,
          type: StockTxnType.OUT,
          reason: `Warranty ${wc.code}: installed in customer PC`,
          refType: "WARRANTY_CASE",
          refId: wc.id,
          newComponentStatus: ComponentStatus.SOLD,
        },
        db,
      );

      const now = new Date();
      await db
        .update(finishedPcComponents)
        .set({ removedAt: now, updatedAt: new Date() })
        .where(eq(finishedPcComponents.id, link.id));
      await db.insert(finishedPcComponents).values({
        id: createId(),
        finishedPcId: wc.finishedPcId!,
        componentId: replacement.id,
        installedAt: now,
        notes: `Replaced via warranty ${wc.code}`,
      });
      await db
        .update(components)
        .set({ currentFinishedPcId: null, updatedAt: new Date() })
        .where(eq(components.id, removed.id));
      await db
        .update(components)
        .set({ currentFinishedPcId: wc.finishedPcId, updatedAt: new Date() })
        .where(eq(components.id, replacement.id));
      const item = (
        await db
          .insert(warrantyItems)
          .values({
            id: createId(),
            warrantyCaseId: wc.id,
            removedComponentId: removed.id,
            replacementComponentId: replacement.id,
            notes: dto.notes ?? null,
          })
          .returning()
      )[0];

      await this.audit.record(
        {
          action: "warranty.replace_component",
          entityType: "WarrantyCase",
          entityId: wc.id,
          before,
          after: {
            warrantyItemId: item.id,
            removedComponentId: removed.id,
            replacementComponentId: replacement.id,
          },
        },
        db,
      );
      return item;
    });
  }
}
