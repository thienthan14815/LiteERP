import { HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { desc, eq, like, or, sql, type SQL } from "drizzle-orm";
import { DbService } from "../../database/db.service";
import { customers, salesOrders, warrantyCases } from "../../database/schema";
import { createId } from "../../database/id";
import { CodeGeneratorService } from "../../common/utils/code-generator.service";
import { AuditLogService } from "../audit-logs/audit-logs.service";
import { BusinessError } from "../../common/exceptions/business.exception";
import { RequestContextService } from "../../common/context/request-context.service";
import { buildPagination, paginate } from "../../common/utils/pagination.util";
import { PaginationDto } from "../../common/dto/pagination.dto";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";

@Injectable()
export class CustomersService {
  constructor(
    private readonly dbs: DbService,
    private readonly codes: CodeGeneratorService,
    private readonly audit: AuditLogService,
    private readonly ctx: RequestContextService,
  ) {}

  async list(q: PaginationDto) {
    const where: SQL | undefined = q.search
      ? or(
          like(customers.name, `%${q.search}%`),
          like(customers.code, `%${q.search}%`),
          like(customers.phone, `%${q.search}%`),
        )
      : undefined;
    const { take, skip } = buildPagination(q.page, q.pageSize);
    const db = this.dbs.db;
    const items = await db
      .select()
      .from(customers)
      .where(where)
      .orderBy(desc(customers.createdAt))
      .limit(take)
      .offset(skip);
    const totalRows = await db
      .select({ count: sql<number>`count(*)`.as("count") })
      .from(customers)
      .where(where);
    const total = Number(totalRows[0]?.count ?? 0);
    return paginate(items, total, q.page ?? 1, q.pageSize ?? 20);
  }

  async get(id: string) {
    const rows = await this.dbs.db.select().from(customers).where(eq(customers.id, id)).limit(1);
    const item = rows[0];
    if (!item) throw new NotFoundException({ code: "CUSTOMER_NOT_FOUND", message: "Customer not found" });
    return item;
  }

  async create(dto: CreateCustomerDto) {
    return this.dbs.transaction(async (db) => {
      const code = dto.code ?? (await this.codes.next("CUS", db, 6));
      const existing = await db.select().from(customers).where(eq(customers.code, code)).limit(1);
      if (existing[0]) throw new BusinessError("CUSTOMER_CODE_TAKEN", `Code ${code} taken`, HttpStatus.CONFLICT);
      const inserted = await db
        .insert(customers)
        .values({
          id: createId(),
          code,
          name: dto.name,
          phone: dto.phone ?? null,
          email: dto.email ?? null,
          address: dto.address ?? null,
          taxCode: dto.taxCode ?? null,
          notes: dto.notes ?? null,
          createdById: this.ctx.getUserId() ?? null,
        })
        .returning();
      const item = inserted[0];
      await this.audit.record(
        { action: "customer.create", entityType: "Customer", entityId: item.id, after: item },
        db,
      );
      return item;
    });
  }

  async update(id: string, dto: UpdateCustomerDto) {
    const beforeRows = await this.dbs.db.select().from(customers).where(eq(customers.id, id)).limit(1);
    const before = beforeRows[0];
    if (!before) throw new NotFoundException({ code: "CUSTOMER_NOT_FOUND", message: "Customer not found" });
    return this.dbs.transaction(async (db) => {
      const updated = await db
        .update(customers)
        .set({
          name: dto.name ?? before.name,
          phone: dto.phone ?? before.phone,
          email: dto.email ?? before.email,
          address: dto.address ?? before.address,
          taxCode: dto.taxCode ?? before.taxCode,
          notes: dto.notes ?? before.notes,
          updatedAt: new Date(),
        })
        .where(eq(customers.id, id))
        .returning();
      const item = updated[0];
      await this.audit.record(
        { action: "customer.update", entityType: "Customer", entityId: id, before, after: item },
        db,
      );
      return item;
    });
  }

  async remove(id: string) {
    const db = this.dbs.db;
    const beforeRows = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
    const customer = beforeRows[0];
    if (!customer) throw new NotFoundException({ code: "CUSTOMER_NOT_FOUND", message: "Customer not found" });
    const salesOrderCountRows = await db
      .select({ count: sql<number>`count(*)`.as("count") })
      .from(salesOrders)
      .where(eq(salesOrders.customerId, id));
    const warrantyCaseCountRows = await db
      .select({ count: sql<number>`count(*)`.as("count") })
      .from(warrantyCases)
      .where(eq(warrantyCases.customerId, id));
    const salesOrderCount = Number(salesOrderCountRows[0]?.count ?? 0);
    const warrantyCaseCount = Number(warrantyCaseCountRows[0]?.count ?? 0);
    if (salesOrderCount > 0 || warrantyCaseCount > 0) {
      throw new BusinessError(
        "CUSTOMER_IN_USE",
        "Customer has linked records, cannot delete",
        HttpStatus.CONFLICT,
      );
    }
    const before = {
      ...customer,
      _count: { salesOrders: salesOrderCount, warrantyCases: warrantyCaseCount },
    };
    await this.dbs.transaction(async (tx) => {
      await tx.delete(customers).where(eq(customers.id, id));
      await this.audit.record(
        { action: "customer.delete", entityType: "Customer", entityId: id, before },
        tx,
      );
    });
    return { success: true };
  }
}
