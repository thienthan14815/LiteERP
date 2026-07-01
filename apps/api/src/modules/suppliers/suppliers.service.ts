import { HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
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
    private readonly prisma: PrismaService,
    private readonly codes: CodeGeneratorService,
    private readonly audit: AuditLogService,
    private readonly ctx: RequestContextService,
  ) {}

  async list(q: PaginationDto) {
    const where: Prisma.SupplierWhereInput = q.search
      ? {
          OR: [
            { name: { contains: q.search, mode: "insensitive" } },
            { code: { contains: q.search, mode: "insensitive" } },
          ],
        }
      : {};
    const { take, skip } = buildPagination(q.page, q.pageSize);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.supplier.findMany({ where, orderBy: { createdAt: "desc" }, take, skip }),
      this.prisma.supplier.count({ where }),
    ]);
    return paginate(items, total, q.page ?? 1, q.pageSize ?? 20);
  }

  async get(id: string) {
    const item = await this.prisma.supplier.findUnique({ where: { id } });
    if (!item) throw new NotFoundException({ code: "SUPPLIER_NOT_FOUND", message: "Supplier not found" });
    return item;
  }

  async create(dto: CreateSupplierDto) {
    return this.prisma.$transaction(async (tx) => {
      const code = dto.code ?? (await this.codes.next("SUP", tx, 6));
      const existing = await tx.supplier.findUnique({ where: { code } });
      if (existing) throw new BusinessError("SUPPLIER_CODE_TAKEN", `Code ${code} taken`, HttpStatus.CONFLICT);
      const item = await tx.supplier.create({
        data: {
          code,
          name: dto.name,
          fbUrl: dto.fbUrl ?? null,
          marketplaceUrl: dto.marketplaceUrl ?? null,
          category: dto.category ?? null,
          notes: dto.notes ?? null,
          createdById: this.ctx.getUserId() ?? null,
        },
      });
      await this.audit.record(
        { action: "supplier.create", entityType: "Supplier", entityId: item.id, after: item },
        tx,
      );
      return item;
    });
  }

  async update(id: string, dto: UpdateSupplierDto) {
    const before = await this.prisma.supplier.findUnique({ where: { id } });
    if (!before) throw new NotFoundException({ code: "SUPPLIER_NOT_FOUND", message: "Supplier not found" });
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.supplier.update({
        where: { id },
        data: {
          name: dto.name ?? before.name,
          fbUrl: dto.fbUrl ?? before.fbUrl,
          marketplaceUrl: dto.marketplaceUrl ?? before.marketplaceUrl,
          category: dto.category ?? before.category,
          notes: dto.notes ?? before.notes,
        },
      });
      await this.audit.record(
        { action: "supplier.update", entityType: "Supplier", entityId: id, before, after: item },
        tx,
      );
      return item;
    });
  }

  // Soft delete: refuse if there are linked purchase orders (preserve history).
  async remove(id: string) {
    const before = await this.prisma.supplier.findUnique({
      where: { id },
      include: { _count: { select: { purchaseOrders: true } } },
    });
    if (!before) throw new NotFoundException({ code: "SUPPLIER_NOT_FOUND", message: "Supplier not found" });
    if (before._count.purchaseOrders > 0) {
      throw new BusinessError(
        "SUPPLIER_IN_USE",
        "Supplier has purchase orders, cannot delete",
        HttpStatus.CONFLICT,
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.supplier.delete({ where: { id } });
      await this.audit.record(
        { action: "supplier.delete", entityType: "Supplier", entityId: id, before },
        tx,
      );
    });
    return { success: true };
  }
}
