import { Injectable, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { and, desc, eq, isNull, like, or, sql, type SQL } from "drizzle-orm";
import { DbService } from "../../database/db.service";
import { refreshTokens, userRoles, users } from "../../database/schema";
import { createId } from "../../database/id";
import { BusinessError } from "../../common/exceptions/business.exception";
import { AuditLogService } from "../audit-logs/audit-logs.service";
import { buildPagination, paginate } from "../../common/utils/pagination.util";
import { PaginationDto } from "../../common/dto/pagination.dto";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

@Injectable()
export class UsersService {
  constructor(private readonly dbs: DbService, private readonly audit: AuditLogService) {}

  // Drizzle equivalent of the old Prisma safeSelect: expose everything except
  // passwordHash, plus userRoles with their role rows.
  private readonly safeSelect = {
    columns: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
    with: { userRoles: { with: { role: true } } },
  } as const;

  async list(q: PaginationDto) {
    const where: SQL | undefined = q.search
      ? or(like(users.email, `%${q.search}%`), like(users.fullName, `%${q.search}%`))
      : undefined;
    const { take, skip } = buildPagination(q.page, q.pageSize);
    const db = this.dbs.db;
    const items = await db.query.users.findMany({
      where,
      ...this.safeSelect,
      orderBy: [desc(users.createdAt)],
      limit: take,
      offset: skip,
    });
    const totalRows = await db
      .select({ count: sql<number>`count(*)`.as("count") })
      .from(users)
      .where(where);
    const total = Number(totalRows[0]?.count ?? 0);
    return paginate(items, total, q.page ?? 1, q.pageSize ?? 20);
  }

  async get(id: string) {
    const user = await this.dbs.db.query.users.findFirst({
      where: eq(users.id, id),
      ...this.safeSelect,
    });
    if (!user) throw new NotFoundException({ code: "USER_NOT_FOUND", message: "User not found" });
    return user;
  }

  async create(dto: CreateUserDto) {
    const exists = (
      await this.dbs.db.select().from(users).where(eq(users.email, dto.email)).limit(1)
    )[0];
    if (exists) throw new BusinessError("EMAIL_TAKEN", `Email ${dto.email} already in use`, 409 as any);
    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.dbs.transaction(async (db) => {
      const user = (
        await db
          .insert(users)
          .values({
            id: createId(),
            email: dto.email,
            passwordHash,
            fullName: dto.fullName,
            phone: dto.phone ?? null,
          })
          .returning()
      )[0];
      if (dto.roleIds?.length) {
        // user_roles has a composite PK (userId, roleId) — no id column.
        await db
          .insert(userRoles)
          .values(dto.roleIds.map((roleId) => ({ userId: user.id, roleId })));
      }
      const fresh = await db.query.users.findFirst({
        where: eq(users.id, user.id),
        ...this.safeSelect,
      });
      if (!fresh) throw new NotFoundException({ code: "USER_NOT_FOUND", message: "User not found" });
      await this.audit.record(
        { action: "user.create", entityType: "User", entityId: user.id, after: fresh },
        db,
      );
      return fresh;
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    const before = await this.dbs.db.query.users.findFirst({
      where: eq(users.id, id),
      ...this.safeSelect,
    });
    if (!before) throw new NotFoundException({ code: "USER_NOT_FOUND", message: "User not found" });
    return this.dbs.transaction(async (db) => {
      const data: Partial<typeof users.$inferInsert> = {};
      if (dto.fullName !== undefined) data.fullName = dto.fullName;
      if (dto.phone !== undefined) data.phone = dto.phone;
      if (dto.isActive !== undefined) data.isActive = dto.isActive;
      if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 10);
      await db
        .update(users)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(users.id, id));
      if (dto.roleIds) {
        await db.delete(userRoles).where(eq(userRoles.userId, id));
        if (dto.roleIds.length) {
          await db
            .insert(userRoles)
            .values(dto.roleIds.map((roleId) => ({ userId: id, roleId })));
        }
      }
      const after = await db.query.users.findFirst({
        where: eq(users.id, id),
        ...this.safeSelect,
      });
      if (!after) throw new NotFoundException({ code: "USER_NOT_FOUND", message: "User not found" });
      await this.audit.record(
        { action: "user.update", entityType: "User", entityId: id, before, after },
        db,
      );
      return after;
    });
  }

  // Soft delete: keep audit trail by simply deactivating the user — per
  // quanlybanhang.md section 14 "không xóa lịch sử" (never destroy history).
  async softDelete(id: string) {
    const before = await this.dbs.db.query.users.findFirst({
      where: eq(users.id, id),
      ...this.safeSelect,
    });
    if (!before) throw new NotFoundException({ code: "USER_NOT_FOUND", message: "User not found" });
    if (!before.isActive) return before;
    return this.dbs.transaction(async (db) => {
      await db
        .update(users)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(users.id, id));
      const after = await db.query.users.findFirst({
        where: eq(users.id, id),
        ...this.safeSelect,
      });
      if (!after) throw new NotFoundException({ code: "USER_NOT_FOUND", message: "User not found" });
      await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.userId, id), isNull(refreshTokens.revokedAt)));
      await this.audit.record(
        { action: "user.deactivate", entityType: "User", entityId: id, before, after },
        db,
      );
      return after;
    });
  }
}
