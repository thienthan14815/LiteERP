import { HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import {
  ComponentStatus,
  FinishedPcStatus,
  StockTxnType,
} from "@app/shared";
import { and, desc, eq, inArray, isNull, like, sql, type SQL } from "drizzle-orm";
import { DbService } from "../../database/db.service";
import { components, finishedPcs, finishedPcComponents } from "../../database/schema";
import { AuditLogService } from "../audit-logs/audit-logs.service";
import { StockTransactionService } from "../inventory/stock-transaction.service";
import { BusinessError } from "../../common/exceptions/business.exception";
import { buildPagination, paginate } from "../../common/utils/pagination.util";
import { QueryFinishedPcDto } from "./dto/query-finished-pc.dto";
import { UpdateFinishedPcDto } from "./dto/update-finished-pc.dto";
import {
  TransitionFinishedPcDto,
  TRANSITIONS_ALLOWED,
} from "./dto/transition-finished-pc.dto";

@Injectable()
export class FinishedPcsService {
  constructor(
    private readonly dbs: DbService,
    private readonly audit: AuditLogService,
    private readonly stock: StockTransactionService,
  ) {}

  async list(q: QueryFinishedPcDto) {
    const conds: SQL[] = [];
    if (q.status) conds.push(eq(finishedPcs.status, q.status));
    if (q.search) conds.push(like(finishedPcs.code, `%${q.search}%`));
    const where = conds.length ? and(...conds) : undefined;
    const { take, skip } = buildPagination(q.page, q.pageSize);
    const db = this.dbs.db;
    const items = await db.query.finishedPcs.findMany({
      where,
      with: {
        assemblyOrder: { columns: { id: true, code: true } },
      },
      orderBy: [desc(finishedPcs.createdAt)],
      limit: take,
      offset: skip,
    });
    const totalRows = await db
      .select({ count: sql<number>`count(*)`.as("count") })
      .from(finishedPcs)
      .where(where);
    const total = Number(totalRows[0]?.count ?? 0);
    // _count.currentComponents emulation: one grouped count over the page ids.
    const ids = items.map((pc) => pc.id);
    const counts = ids.length
      ? await db
          .select({
            refId: components.currentFinishedPcId,
            count: sql<number>`count(*)`.as("count"),
          })
          .from(components)
          .where(inArray(components.currentFinishedPcId, ids))
          .groupBy(components.currentFinishedPcId)
      : [];
    const countMap = new Map(counts.map((c) => [c.refId, Number(c.count)]));
    const projected = items.map((pc) => ({
      ...pc,
      componentCount: countMap.get(pc.id) ?? 0,
    }));
    return paginate(projected, total, q.page ?? 1, q.pageSize ?? 20);
  }

  async get(id: string) {
    const item = await this.dbs.db.query.finishedPcs.findFirst({
      where: eq(finishedPcs.id, id),
      with: {
        assemblyOrder: { columns: { id: true, code: true, status: true } },
        componentLinks: {
          with: {
            component: { with: { category: true } },
          },
          orderBy: [desc(finishedPcComponents.installedAt)],
        },
        currentComponents: { with: { category: true } },
        salesItems: {
          with: { salesOrder: { columns: { id: true, code: true, status: true, confirmedAt: true } } },
        },
      },
    });
    if (!item) {
      throw new NotFoundException({ code: "FINISHED_PC_NOT_FOUND", message: "Finished PC not found" });
    }

    const currentComponents = item.currentComponents.map((c) => ({
      id: c.id,
      code: c.code,
      categoryCode: c.category.code,
      model: c.model,
      serial: c.serialNumber,
      status: c.status,
      costPrice: Number(c.costPrice),
    }));
    const componentHistory = item.componentLinks.map((l) => ({
      id: l.id,
      componentId: l.componentId,
      componentCode: l.component.code,
      categoryCode: l.component.category.code,
      model: l.component.model,
      serial: l.component.serialNumber,
      // Nested relation rows may deserialize timestamps as raw millis;
      // normalise to Date so JSON keeps the previous ISO string shape.
      installedAt: new Date(l.installedAt),
      removedAt: l.removedAt === null ? null : new Date(l.removedAt),
      isCurrent: l.removedAt === null,
    }));

    return {
      ...item,
      currentComponents,
      componentHistory,
      // Repair history will be wired in Phase 3 (warranty/repair).
      repairHistory: [] as Array<unknown>,
    };
  }

  async update(id: string, dto: UpdateFinishedPcDto) {
    const beforeRows = await this.dbs.db
      .select()
      .from(finishedPcs)
      .where(eq(finishedPcs.id, id))
      .limit(1);
    const before = beforeRows[0];
    if (!before) {
      throw new NotFoundException({ code: "FINISHED_PC_NOT_FOUND", message: "Finished PC not found" });
    }
    if (before.status === FinishedPcStatus.SOLD || before.status === FinishedPcStatus.SCRAPPED) {
      throw new BusinessError(
        "INVALID_STATUS_TRANSITION",
        `Cannot edit finished PC in status ${before.status}`,
        HttpStatus.CONFLICT,
      );
    }
    return this.dbs.transaction(async (db) => {
      const afterRows = await db
        .update(finishedPcs)
        .set({
          suggestedPrice: dto.suggestedPrice ?? before.suggestedPrice,
          notes: dto.notes ?? before.notes,
          updatedAt: new Date(),
        })
        .where(eq(finishedPcs.id, id))
        .returning();
      const after = afterRows[0];
      await this.audit.record(
        { action: "finished_pc.update", entityType: "FinishedPc", entityId: id, before, after },
        db,
      );
      return after;
    });
  }

  async transition(id: string, dto: TransitionFinishedPcDto) {
    const beforeRows = await this.dbs.db
      .select()
      .from(finishedPcs)
      .where(eq(finishedPcs.id, id))
      .limit(1);
    const before = beforeRows[0];
    if (!before) {
      throw new NotFoundException({ code: "FINISHED_PC_NOT_FOUND", message: "Finished PC not found" });
    }
    const allowed = TRANSITIONS_ALLOWED[before.status] ?? [];
    if (!allowed.includes(dto.to as unknown as FinishedPcStatus)) {
      throw new BusinessError(
        "INVALID_STATUS_TRANSITION",
        `Cannot transition ${before.status} -> ${dto.to}`,
        HttpStatus.CONFLICT,
      );
    }
    return this.dbs.transaction(async (db) => {
      const afterRows = await db
        .update(finishedPcs)
        .set({
          status: dto.to,
          readyAt: dto.to === "READY_FOR_SALE" ? new Date() : before.readyAt,
          updatedAt: new Date(),
        })
        .where(eq(finishedPcs.id, id))
        .returning();
      const after = afterRows[0];
      await this.audit.record(
        {
          action: "finished_pc.transition",
          entityType: "FinishedPc",
          entityId: id,
          before,
          after,
        },
        db,
      );
      return after;
    });
  }

  async scrap(id: string) {
    const before = await this.dbs.db.query.finishedPcs.findFirst({
      where: eq(finishedPcs.id, id),
      with: { currentComponents: true },
    });
    if (!before) {
      throw new NotFoundException({ code: "FINISHED_PC_NOT_FOUND", message: "Finished PC not found" });
    }
    if (before.status === FinishedPcStatus.SOLD || before.status === FinishedPcStatus.SCRAPPED) {
      throw new BusinessError(
        "INVALID_STATUS_TRANSITION",
        `Cannot scrap finished PC in status ${before.status}`,
        HttpStatus.CONFLICT,
      );
    }
    return this.dbs.transaction(async (db) => {
      for (const c of before.currentComponents) {
        await this.stock.create(
          {
            componentId: c.id,
            type: StockTxnType.SCRAP,
            reason: `Finished PC ${before.code} scrapped`,
            refType: "FINISHED_PC",
            refId: id,
            newComponentStatus: ComponentStatus.SCRAPPED,
          },
          db,
        );
        await db
          .update(finishedPcComponents)
          .set({ removedAt: new Date(), updatedAt: new Date() })
          .where(
            and(
              eq(finishedPcComponents.finishedPcId, id),
              eq(finishedPcComponents.componentId, c.id),
              isNull(finishedPcComponents.removedAt),
            ),
          );
        await db
          .update(components)
          .set({ currentFinishedPcId: null, updatedAt: new Date() })
          .where(eq(components.id, c.id));
      }
      const afterRows = await db
        .update(finishedPcs)
        .set({ status: FinishedPcStatus.SCRAPPED, updatedAt: new Date() })
        .where(eq(finishedPcs.id, id))
        .returning();
      const after = afterRows[0];
      await this.audit.record(
        { action: "finished_pc.scrap", entityType: "FinishedPc", entityId: id, before, after },
        db,
      );
      return after;
    });
  }
}
