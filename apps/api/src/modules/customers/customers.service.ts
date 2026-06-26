import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
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
    private readonly prisma: PrismaService,
    private readonly codes: CodeGeneratorService,
    private readonly audit: AuditLogService,
    private readonly ctx: RequestContextService,
  ) {}

  async list(q: PaginationDto) {
    const where: Prisma.CustomerWhereInput = q.search
      ? {
          OR: [
            { name: { contains: q.search, mode: "insensitive" } },
            { code: { contains: q.search, mode: "insensitive" } },
            { phone: { contains: q.search, mode: "insensitive" } },
          ],
        }
      : {};
    const { take, skip } = buildPagination(q.page, q.pageSize);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({ where, orderBy: { createdAt: "desc" }, take, skip }),
      this.prisma.customer.count({ where }),
    ]);
    return paginate(items, total, q.page ?? 1, q.pageSize ?? 20);
  }

  async get(id: string) {
    const item = await this.prisma.customer.findUnique({ where: { id } });
    if (!item) throw new NotFoundException({ code: "CUSTOMER_NOT_FOUND", message: "Customer not found" });
    return item;
  }

  async create(dto: CreateCustomerDto) {
    return this.prisma.$transaction(async (tx) => {
      const code = dto.code ?? (await this.codes.next("CUS", tx, 6));
      const existing = await tx.customer.findUnique({ where: { code } });
      if (existing) throw new BusinessError("CUSTOMER_CODE_TAKEN", `Code ${code} taken`, 409 as any);
      const item = await tx.customer.create({
        data: {
          code,
          name: dto.name,
          phone: dto.phone ?? null,
          email: dto.email ?? null,
          address: dto.address ?? null,
          taxCode: dto.taxCode ?? null,
          notes: dto.notes ?? null,
          createdById: this.ctx.getUserId() ?? null,
        },
      });
      await this.audit.record(
        { action: "customer.create", entityType: "Customer", entityId: item.id, after: item },
        tx,
      );
      return item;
    });
  }

  async update(id: string, dto: UpdateCustomerDto) {
    const before = await this.prisma.customer.findUnique({ where: { id } });
    if (!before) throw new NotFoundException({ code: "CUSTOMER_NOT_FOUND", message: "Customer not found" });
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.customer.update({
        where: { id },
        data: {
          name: dto.name ?? before.name,
          phone: dto.phone ?? before.phone,
          email: dto.email ?? before.email,
          address: dto.address ?? before.address,
          taxCode: dto.taxCode ?? before.taxCode,
          notes: dto.notes ?? before.notes,
        },
      });
      await this.audit.record(
        { action: "customer.update", entityType: "Customer", entityId: id, before, after: item },
        tx,
      );
      return item;
    });
  }

  async remove(id: string) {
    const before = await this.prisma.customer.findUnique({
      where: { id },
      include: { _count: { select: { salesOrders: true, warrantyCases: true } } },
    });
    if (!before) throw new NotFoundException({ code: "CUSTOMER_NOT_FOUND", message: "Customer not found" });
    if (before._count.salesOrders > 0 || before._count.warrantyCases > 0) {
      throw new BusinessError(
        "CUSTOMER_IN_USE",
        "Customer has linked records, cannot delete",
        409 as any,
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.customer.delete({ where: { id } });
      await this.audit.record(
        { action: "customer.delete", entityType: "Customer", entityId: id, before },
        tx,
      );
    });
    return { success: true };
  }
}
