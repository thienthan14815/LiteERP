import { HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, desc, eq, inArray, like, ne, or, sql, type SQL } from "drizzle-orm";
import { ComponentStatus, StockTxnType } from "@app/shared";
import { DbService } from "../../database/db.service";
import {
  attachments,
  componentCategories,
  components,
  finishedPcComponents,
  stockTransactions,
} from "../../database/schema";
import { AuditLogService } from "../audit-logs/audit-logs.service";
import { StockTransactionService } from "../inventory/stock-transaction.service";
import { DriveService } from "../drive/drive.service";
import { BusinessError } from "../../common/exceptions/business.exception";
import { buildPagination, paginate } from "../../common/utils/pagination.util";
import { QueryComponentDto } from "./dto/query-component.dto";
import { UpdateComponentDto } from "./dto/update-component.dto";

@Injectable()
export class ComponentsService {
  constructor(
    private readonly dbs: DbService,
    private readonly audit: AuditLogService,
    private readonly stock: StockTransactionService,
    private readonly drive: DriveService,
  ) {}

  async list(q: QueryComponentDto) {
    const db = this.dbs.db;
    const conds: SQL[] = [];
    if (q.status) conds.push(eq(components.status, q.status));
    if (q.condition) conds.push(eq(components.condition, q.condition));
    if (q.categoryId) conds.push(eq(components.categoryId, q.categoryId));
    if (q.categoryCode) {
      // Relation filter (category.code): resolve to the categoryId first —
      // category codes are unique, so this matches Prisma's `category: { code }`.
      const catRows = await db
        .select({ id: componentCategories.id })
        .from(componentCategories)
        .where(eq(componentCategories.code, q.categoryCode))
        .limit(1);
      const cat = catRows[0];
      if (cat) conds.push(eq(components.categoryId, cat.id));
      else conds.push(sql`1 = 0`);
    }
    if (q.search) {
      const term = `%${q.search}%`;
      const searchCond = or(
        like(components.code, term),
        like(components.serialNumber, term),
        like(components.model, term),
      );
      if (searchCond) conds.push(searchCond);
    }
    const where = conds.length ? and(...conds) : undefined;
    const { take, skip } = buildPagination(q.page, q.pageSize);
    const items = await db.query.components.findMany({
      where,
      with: { category: true },
      orderBy: [desc(components.createdAt)],
      limit: take,
      offset: skip,
    });
    const totalRows = await db
      .select({ count: sql<number>`count(*)`.as("count") })
      .from(components)
      .where(where);
    const total = Number(totalRows[0]?.count ?? 0);

    // Lấy ảnh đầu tiên (mimeType image/*) cho mỗi component trong trang.
    const ids = items.map((c) => c.id);
    const thumbById = new Map<string, string>();
    if (ids.length > 0) {
      // relatedType lịch sử có 2 biến thể: "Component" (Pascal) từ UI chi tiết,
      // "COMPONENT" (Screaming) từ các nơi khác — match cả hai.
      const atts = await db
        .select()
        .from(attachments)
        .where(
          and(
            inArray(attachments.relatedType, ["Component", "COMPONENT"]),
            inArray(attachments.relatedId, ids),
            like(attachments.mimeType, "image/%"),
          ),
        )
        .orderBy(asc(attachments.createdAt));
      for (const a of atts) {
        if (!thumbById.has(a.relatedId) && a.driveFileId) {
          thumbById.set(a.relatedId, this.drive.getThumbnailUrl(a.driveFileId));
        }
      }
    }

    const projected = items.map((c) => ({
      ...c,
      serial: c.serialNumber,
      categoryCode: c.category.code,
      thumbnailUrl: thumbById.get(c.id) ?? null,
    }));
    return paginate(projected, total, q.page ?? 1, q.pageSize ?? 20);
  }

  async get(id: string) {
    const item = await this.dbs.db.query.components.findFirst({
      where: eq(components.id, id),
      with: {
        category: true,
        sourceMachine: true,
        currentFinishedPc: true,
        finishedPcLinks: {
          with: { finishedPc: { columns: { id: true, code: true, status: true } } },
          orderBy: [desc(finishedPcComponents.installedAt)],
        },
        stockTransactions: { orderBy: [desc(stockTransactions.createdAt)] },
      },
    });
    if (!item) throw new NotFoundException({ code: "COMPONENT_NOT_FOUND", message: "Component not found" });

    const { finishedPcLinks, category, ...rest } = item;
    return {
      ...rest,
      serial: rest.serialNumber,
      categoryCode: category.code,
      category,
      history: finishedPcLinks.map((link) => ({
        finishedPcId: link.finishedPcId,
        finishedPcCode: link.finishedPc.code,
        finishedPcStatus: link.finishedPc.status,
        installedAt: link.installedAt,
        removedAt: link.removedAt,
      })),
    };
  }

  async getBySerial(serial: string) {
    const item = await this.dbs.db.query.components.findFirst({
      where: eq(components.serialNumber, serial),
      with: { category: true, currentFinishedPc: true, sourceMachine: true },
    });
    if (!item) throw new NotFoundException({ code: "COMPONENT_NOT_FOUND", message: "Component not found" });
    return item;
  }

  async update(id: string, dto: UpdateComponentDto) {
    const beforeRows = await this.dbs.db
      .select()
      .from(components)
      .where(eq(components.id, id))
      .limit(1);
    const before = beforeRows[0];
    if (!before) throw new NotFoundException({ code: "COMPONENT_NOT_FOUND", message: "Component not found" });

    if (dto.serialNumber && dto.serialNumber !== before.serialNumber) {
      const dupRows = await this.dbs.db
        .select({ id: components.id })
        .from(components)
        .where(and(eq(components.serialNumber, dto.serialNumber), ne(components.id, id)))
        .limit(1);
      if (dupRows[0]) {
        throw new BusinessError(
          "SERIAL_TAKEN",
          `Serial ${dto.serialNumber} already in use`,
          HttpStatus.CONFLICT,
        );
      }
    }

    return this.dbs.transaction(async (db) => {
      const updated = await db
        .update(components)
        .set({
          condition: dto.condition ?? before.condition,
          location: dto.location ?? before.location,
          model: dto.model ?? before.model,
          serialNumber: dto.serialNumber ?? before.serialNumber,
          notes: dto.notes ?? before.notes,
          updatedAt: new Date(),
        })
        .where(eq(components.id, id))
        .returning();
      const after = updated[0];
      await this.audit.record(
        { action: "component.update", entityType: "Component", entityId: id, before, after },
        db,
      );
      return after;
    });
  }

  async scrap(id: string) {
    const beforeRows = await this.dbs.db
      .select()
      .from(components)
      .where(eq(components.id, id))
      .limit(1);
    const before = beforeRows[0];
    if (!before) throw new NotFoundException({ code: "COMPONENT_NOT_FOUND", message: "Component not found" });
    if (before.status !== ComponentStatus.IN_STOCK) {
      throw new BusinessError(
        "INVALID_STATUS_TRANSITION",
        `Cannot scrap component in status ${before.status}`,
        HttpStatus.CONFLICT,
      );
    }
    return this.dbs.transaction(async (db) => {
      await this.stock.create(
        {
          componentId: id,
          type: StockTxnType.SCRAP,
          reason: "Component scrapped",
          newComponentStatus: ComponentStatus.SCRAPPED,
          refType: "COMPONENT",
          refId: id,
        },
        db,
      );
      const afterRows = await db.select().from(components).where(eq(components.id, id)).limit(1);
      const after = afterRows[0];
      if (!after) throw new NotFoundException({ code: "COMPONENT_NOT_FOUND", message: "Component not found" });
      await this.audit.record(
        { action: "component.scrap", entityType: "Component", entityId: id, before, after },
        db,
      );
      return after;
    });
  }
}
