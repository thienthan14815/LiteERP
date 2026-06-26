import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import * as argon2 from "argon2";
import { PrismaService } from "../../database/prisma.service";
import { BusinessError } from "../../common/exceptions/business.exception";
import { AuditLogService } from "../audit-logs/audit-logs.service";
import { buildPagination, paginate } from "../../common/utils/pagination.util";
import { PaginationDto } from "../../common/dto/pagination.dto";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditLogService) {}

  private readonly safeSelect = {
    id: true,
    email: true,
    fullName: true,
    phone: true,
    isActive: true,
    lastLoginAt: true,
    createdAt: true,
    updatedAt: true,
    userRoles: { include: { role: true } },
  } satisfies Prisma.UserSelect;

  async list(q: PaginationDto) {
    const where: Prisma.UserWhereInput = q.search
      ? {
          OR: [
            { email: { contains: q.search, mode: "insensitive" } },
            { fullName: { contains: q.search, mode: "insensitive" } },
          ],
        }
      : {};
    const { take, skip } = buildPagination(q.page, q.pageSize);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: this.safeSelect,
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginate(items, total, q.page ?? 1, q.pageSize ?? 20);
  }

  async get(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: this.safeSelect });
    if (!user) throw new NotFoundException({ code: "USER_NOT_FOUND", message: "User not found" });
    return user;
  }

  async create(dto: CreateUserDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new BusinessError("EMAIL_TAKEN", `Email ${dto.email} already in use`, 409 as any);
    const passwordHash = await argon2.hash(dto.password);
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          fullName: dto.fullName,
          phone: dto.phone ?? null,
        },
      });
      if (dto.roleIds?.length) {
        await tx.userRole.createMany({
          data: dto.roleIds.map((roleId) => ({ userId: user.id, roleId })),
          skipDuplicates: true,
        });
      }
      const fresh = await tx.user.findUniqueOrThrow({
        where: { id: user.id },
        select: this.safeSelect,
      });
      await this.audit.record(
        { action: "user.create", entityType: "User", entityId: user.id, after: fresh },
        tx,
      );
      return fresh;
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    const before = await this.prisma.user.findUnique({ where: { id }, select: this.safeSelect });
    if (!before) throw new NotFoundException({ code: "USER_NOT_FOUND", message: "User not found" });
    return this.prisma.$transaction(async (tx) => {
      const data: Prisma.UserUpdateInput = {};
      if (dto.fullName !== undefined) data.fullName = dto.fullName;
      if (dto.phone !== undefined) data.phone = dto.phone;
      if (dto.isActive !== undefined) data.isActive = dto.isActive;
      if (dto.password) data.passwordHash = await argon2.hash(dto.password);
      await tx.user.update({ where: { id }, data });
      if (dto.roleIds) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        if (dto.roleIds.length) {
          await tx.userRole.createMany({
            data: dto.roleIds.map((roleId) => ({ userId: id, roleId })),
            skipDuplicates: true,
          });
        }
      }
      const after = await tx.user.findUniqueOrThrow({ where: { id }, select: this.safeSelect });
      await this.audit.record(
        { action: "user.update", entityType: "User", entityId: id, before, after },
        tx,
      );
      return after;
    });
  }

  // Soft delete: keep audit trail by simply deactivating the user — per
  // quanlybanhang.md section 14 "không xóa lịch sử" (never destroy history).
  async softDelete(id: string) {
    const before = await this.prisma.user.findUnique({ where: { id }, select: this.safeSelect });
    if (!before) throw new NotFoundException({ code: "USER_NOT_FOUND", message: "User not found" });
    if (!before.isActive) return before;
    return this.prisma.$transaction(async (tx) => {
      const after = await tx.user.update({
        where: { id },
        data: { isActive: false },
        select: this.safeSelect,
      });
      await tx.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record(
        { action: "user.deactivate", entityType: "User", entityId: id, before, after },
        tx,
      );
      return after;
    });
  }
}
