import { HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { DbService } from "../../database/db.service";
import { roles, permissions, rolePermissions, userRoles } from "../../database/schema";
import { createId } from "../../database/id";
import { BusinessError } from "../../common/exceptions/business.exception";
import { AuditLogService } from "../audit-logs/audit-logs.service";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";

@Injectable()
export class RolesService {
  constructor(private readonly dbs: DbService, private readonly audit: AuditLogService) {}

  list() {
    return this.dbs.db.query.roles.findMany({
      with: { rolePermissions: { with: { permission: true } } },
      orderBy: [asc(roles.code)],
    });
  }

  async create(dto: CreateRoleDto) {
    const existsRows = await this.dbs.db.select().from(roles).where(eq(roles.code, dto.code)).limit(1);
    if (existsRows[0]) throw new BusinessError("ROLE_CODE_TAKEN", `Role code ${dto.code} already exists`, HttpStatus.CONFLICT);
    return this.dbs.transaction(async (db) => {
      const inserted = await db
        .insert(roles)
        .values({ id: createId(), code: dto.code, name: dto.name, description: dto.description ?? null })
        .returning();
      const role = inserted[0];
      if (dto.permissionCodes?.length) {
        const perms = await db
          .select()
          .from(permissions)
          .where(inArray(permissions.code, dto.permissionCodes));
        if (perms.length) {
          await db
            .insert(rolePermissions)
            .values(perms.map((p) => ({ roleId: role.id, permissionId: p.id })));
        }
      }
      await this.audit.record(
        { action: "role.create", entityType: "Role", entityId: role.id, after: role },
        db,
      );
      const created = await db.query.roles.findFirst({
        where: eq(roles.id, role.id),
        with: { rolePermissions: { with: { permission: true } } },
      });
      if (!created) throw new NotFoundException({ code: "ROLE_NOT_FOUND", message: "Role not found" });
      return created;
    });
  }

  async update(id: string, dto: UpdateRoleDto) {
    const before = await this.dbs.db.query.roles.findFirst({
      where: eq(roles.id, id),
      with: { rolePermissions: true },
    });
    if (!before) throw new NotFoundException({ code: "ROLE_NOT_FOUND", message: "Role not found" });
    return this.dbs.transaction(async (db) => {
      const data: { name?: string; description?: string | null } = {};
      if (dto.name !== undefined) data.name = dto.name;
      if (dto.description !== undefined) data.description = dto.description;
      await db
        .update(roles)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(roles.id, id));
      if (dto.permissionCodes) {
        await db.delete(rolePermissions).where(eq(rolePermissions.roleId, id));
        const perms = dto.permissionCodes.length
          ? await db.select().from(permissions).where(inArray(permissions.code, dto.permissionCodes))
          : [];
        if (perms.length) {
          await db
            .insert(rolePermissions)
            .values(perms.map((p) => ({ roleId: id, permissionId: p.id })));
        }
      }
      const after = await db.query.roles.findFirst({
        where: eq(roles.id, id),
        with: { rolePermissions: { with: { permission: true } } },
      });
      if (!after) throw new NotFoundException({ code: "ROLE_NOT_FOUND", message: "Role not found" });
      await this.audit.record(
        { action: "role.update", entityType: "Role", entityId: id, before, after },
        db,
      );
      return after;
    });
  }

  async remove(id: string) {
    const db = this.dbs.db;
    const roleRows = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
    const role = roleRows[0];
    if (!role) throw new NotFoundException({ code: "ROLE_NOT_FOUND", message: "Role not found" });
    if (role.isSystem) {
      throw new BusinessError("ROLE_IS_SYSTEM", "Cannot delete system role", HttpStatus.CONFLICT);
    }
    const userRoleCountRows = await db
      .select({ count: sql<number>`count(*)`.as("count") })
      .from(userRoles)
      .where(eq(userRoles.roleId, id));
    const userRoleCount = Number(userRoleCountRows[0]?.count ?? 0);
    if (userRoleCount > 0) {
      throw new BusinessError(
        "ROLE_IN_USE",
        "Role has users assigned, cannot delete",
        HttpStatus.CONFLICT,
      );
    }
    const before = { ...role, _count: { userRoles: userRoleCount } };
    await this.dbs.transaction(async (tx) => {
      await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, id));
      await tx.delete(roles).where(eq(roles.id, id));
      await this.audit.record(
        { action: "role.delete", entityType: "Role", entityId: id, before },
        tx,
      );
    });
    return { success: true };
  }
}
