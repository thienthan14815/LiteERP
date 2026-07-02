import { HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { MasterOptionType, Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { AuditLogService } from "../audit-logs/audit-logs.service";
import { BusinessError } from "../../common/exceptions/business.exception";
import {
  CreateMasterOptionDto,
  UpdateMasterOptionDto,
} from "./dto/master-option.dto";

@Injectable()
export class MasterOptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async list(type?: MasterOptionType) {
    const where: Prisma.MasterOptionWhereInput = {};
    if (type) where.type = type;
    return this.prisma.masterOption.findMany({
      where,
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });
  }

  async create(dto: CreateMasterOptionDto) {
    const name = dto.name.trim();
    if (!name) {
      throw new BusinessError("MASTER_OPTION_NAME_REQUIRED", "Name is required", HttpStatus.BAD_REQUEST);
    }
    return this.prisma.$transaction(async (tx) => {
      const dup = await tx.masterOption.findFirst({
        where: { type: dto.type, name },
      });
      if (dup) {
        throw new BusinessError(
          "MASTER_OPTION_DUPLICATE",
          `"${name}" đã tồn tại`,
          HttpStatus.CONFLICT,
        );
      }
      const item = await tx.masterOption.create({
        data: { type: dto.type, name, notes: dto.notes ?? null },
      });
      await this.audit.record(
        { action: "master_option.create", entityType: "MasterOption", entityId: item.id, after: item },
        tx,
      );
      return item;
    });
  }

  async update(id: string, dto: UpdateMasterOptionDto) {
    const before = await this.prisma.masterOption.findUnique({ where: { id } });
    if (!before) throw new NotFoundException({ code: "MASTER_OPTION_NOT_FOUND", message: "Not found" });
    const name = dto.name?.trim();
    if (name && name !== before.name) {
      const dup = await this.prisma.masterOption.findFirst({
        where: { type: before.type, name, NOT: { id } },
      });
      if (dup) {
        throw new BusinessError(
          "MASTER_OPTION_DUPLICATE",
          `"${name}" đã tồn tại`,
          HttpStatus.CONFLICT,
        );
      }
    }
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.masterOption.update({
        where: { id },
        data: {
          name: name ?? before.name,
          notes: dto.notes !== undefined ? dto.notes : before.notes,
        },
      });
      await this.audit.record(
        { action: "master_option.update", entityType: "MasterOption", entityId: id, before, after: item },
        tx,
      );
      return item;
    });
  }

  async remove(id: string) {
    const before = await this.prisma.masterOption.findUnique({ where: { id } });
    if (!before) throw new NotFoundException({ code: "MASTER_OPTION_NOT_FOUND", message: "Not found" });
    await this.prisma.$transaction(async (tx) => {
      await tx.masterOption.delete({ where: { id } });
      await this.audit.record(
        { action: "master_option.delete", entityType: "MasterOption", entityId: id, before },
        tx,
      );
    });
    return { success: true };
  }
}
