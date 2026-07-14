import { HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { desc, eq, like, or, sql, type SQL } from "drizzle-orm";
import { DbService } from "../../database/db.service";
import { suppliers, purchaseOrders } from "../../database/schema";
import { createId } from "../../database/id";
import { CodeGeneratorService } from "../../common/utils/code-generator.service";
import { AuditLogService } from "../audit-logs/audit-logs.service";
import { BusinessError } from "../../common/exceptions/business.exception";
import { RequestContextService } from "../../common/context/request-context.service";
import { buildPagination, paginate } from "../../common/utils/pagination.util";
import { PaginationDto } from "../../common/dto/pagination.dto";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";

@Injectable()
export class SuppliersService {
  constructor(
    private readonly dbs: DbService,
    private readonly codes: CodeGeneratorService,
    private readonly audit: AuditLogService,
    private readonly ctx: RequestContextService,
  ) {}

  async list(q: PaginationDto) {
    const where: SQL | undefined = q.search
      ? or(like(suppliers.name, `%${q.search}%`), like(suppliers.code, `%${q.search}%`))
      : undefined;
    const { take, skip } = buildPagination(q.page, q.pageSize);
    const db = this.dbs.db;
    const items = await db
      .select()
      .from(suppliers)
      .where(where)
      .orderBy(desc(suppliers.createdAt))
      .limit(take)
      .offset(skip);
    const totalRows = await db
      .select({ count: sql<number>`count(*)`.as("count") })
      .from(suppliers)
      .where(where);
    const total = Number(totalRows[0]?.count ?? 0);
    return paginate(items, total, q.page ?? 1, q.pageSize ?? 20);
  }

  async get(id: string) {
    const rows = await this.dbs.db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
    const item = rows[0];
    if (!item) throw new NotFoundException({ code: "SUPPLIER_NOT_FOUND", message: "Supplier not found" });
    return item;
  }

  async create(dto: CreateSupplierDto) {
    return this.dbs.transaction(async (db) => {
      const code = dto.code ?? (await this.codes.next("SUP", db, 6));
      const existing = await db.select().from(suppliers).where(eq(suppliers.code, code)).limit(1);
      if (existing[0]) throw new BusinessError("SUPPLIER_CODE_TAKEN", `Code ${code} taken`, HttpStatus.CONFLICT);
      const inserted = await db
        .insert(suppliers)
        .values({
          id: createId(),
          code,
          name: dto.name,
          fbUrl: dto.fbUrl ?? null,
          marketplaceUrl: dto.marketplaceUrl ?? null,
          category: dto.category ?? null,
          notes: dto.notes ?? null,
          createdById: this.ctx.getUserId() ?? null,
        })
        .returning();
      const item = inserted[0];
      await this.audit.record(
        { action: "supplier.create", entityType: "Supplier", entityId: item.id, after: item },
        db,
      );
      return item;
    });
  }

  async update(id: string, dto: UpdateSupplierDto) {
    const beforeRows = await this.dbs.db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
    const before = beforeRows[0];
    if (!before) throw new NotFoundException({ code: "SUPPLIER_NOT_FOUND", message: "Supplier not found" });
    return this.dbs.transaction(async (db) => {
      const updated = await db
        .update(suppliers)
        .set({
          name: dto.name ?? before.name,
          fbUrl: dto.fbUrl ?? before.fbUrl,
          marketplaceUrl: dto.marketplaceUrl ?? before.marketplaceUrl,
          category: dto.category ?? before.category,
          notes: dto.notes ?? before.notes,
          updatedAt: new Date(),
        })
        .where(eq(suppliers.id, id))
        .returning();
      const item = updated[0];
      await this.audit.record(
        { action: "supplier.update", entityType: "Supplier", entityId: id, before, after: item },
        db,
      );
      return item;
    });
  }

  // Soft delete: refuse if there are linked purchase orders (preserve history).
  async remove(id: string) {
    const db = this.dbs.db;
    const beforeRows = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
    const before = beforeRows[0];
    if (!before) throw new NotFoundException({ code: "SUPPLIER_NOT_FOUND", message: "Supplier not found" });
    const poCountRows = await db
      .select({ count: sql<number>`count(*)`.as("count") })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.supplierId, id));
    if (Number(poCountRows[0]?.count ?? 0) > 0) {
      throw new BusinessError(
        "SUPPLIER_IN_USE",
        "Supplier has purchase orders, cannot delete",
        HttpStatus.CONFLICT,
      );
    }
    await this.dbs.transaction(async (tx) => {
      await tx.delete(suppliers).where(eq(suppliers.id, id));
      await this.audit.record(
        { action: "supplier.delete", entityType: "Supplier", entityId: id, before },
        tx,
      );
    });
    return { success: true };
  }
}
