import { HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { BusinessError } from "../../common/exceptions/business.exception";
import { AuditLogService } from "../audit-logs/audit-logs.service";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditLogService) {}

  list() {
    return this.prisma.role.findMany({
      include: { rolePermissions: { include: { permission: true } } },
      orderBy: { code: "asc" },
    });
  }

  async create(dto: CreateRoleDto) {
    const exists = await this.prisma.role.findUnique({ where: { code: dto.code } });
    if (exists) throw new BusinessError("ROLE_CODE_TAKEN", `Role code ${dto.code} already exists`, HttpStatus.CONFLICT);
    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: { code: dto.code, name: dto.name, description: dto.description ?? null },
      });
      if (dto.permissionCodes?.length) {
        const perms = await tx.permission.findMany({ where: { code: { in: dto.permissionCodes } } });
        await tx.rolePermission.createMany({
          data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
        });
      }
      await this.audit.record(
        { action: "role.create", entityType: "Role", entityId: role.id, after: role },
        tx,
      );
      return tx.role.findUniqueOrThrow({
        where: { id: role.id },
        include: { rolePermissions: { include: { permission: true } } },
      });
    });
  }

  async update(id: string, dto: UpdateRoleDto) {
    const before = await this.prisma.role.findUnique({
      where: { id },
      include: { rolePermissions: true },
    });
    if (!before) throw new NotFoundException({ code: "ROLE_NOT_FOUND", message: "Role not found" });
    return this.prisma.$transaction(async (tx) => {
      const data: Prisma.RoleUpdateInput = {};
      if (dto.name !== undefined) data.name = dto.name;
      if (dto.description !== undefined) data.description = dto.description;
      const role = await tx.role.update({ where: { id }, data });
      if (dto.permissionCodes) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        const perms = await tx.permission.findMany({ where: { code: { in: dto.permissionCodes } } });
        if (perms.length) {
          await tx.rolePermission.createMany({
            data: perms.map((p) => ({ roleId: id, permissionId: p.id })),
          });
        }
      }
      const after = await tx.role.findUniqueOrThrow({
        where: { id },
        include: { rolePermissions: { include: { permission: true } } },
      });
      await this.audit.record(
        { action: "role.update", entityType: "Role", entityId: id, before, after },
        tx,
      );
      return after;
    });
  }

  async remove(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { userRoles: true } } },
    });
    if (!role) throw new NotFoundException({ code: "ROLE_NOT_FOUND", message: "Role not found" });
    if (role.isSystem) {
      throw new BusinessError("ROLE_IS_SYSTEM", "Cannot delete system role", HttpStatus.CONFLICT);
    }
    if (role._count.userRoles > 0) {
      throw new BusinessError(
        "ROLE_IN_USE",
        "Role has users assigned, cannot delete",
        HttpStatus.CONFLICT,
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      await tx.role.delete({ where: { id } });
      await this.audit.record(
        { action: "role.delete", entityType: "Role", entityId: id, before: role },
        tx,
      );
    });
    return { success: true };
  }
}
