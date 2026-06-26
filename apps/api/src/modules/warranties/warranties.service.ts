import { HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import {
  ComponentStatus,
  FinishedPcStatus,
  Prisma,
  StockTxnType,
  WarrantyStatus,
} from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { CodeGeneratorService } from "../../common/utils/code-generator.service";
import { AuditLogService } from "../audit-logs/audit-logs.service";
import { StockTransactionService } from "../inventory/stock-transaction.service";
import { BusinessError } from "../../common/exceptions/business.exception";
import { RequestContextService } from "../../common/context/request-context.service";
import { buildPagination, paginate } from "../../common/utils/pagination.util";
import { CreateWarrantyDto } from "./dto/create-warranty.dto";
import { QueryWarrantyDto } from "./dto/query-warranty.dto";
import { TransitionWarrantyDto, WARRANTY_TRANSITIONS } from "./dto/transition-warranty.dto";
import { ReplaceComponentDto } from "./dto/replace-component.dto";

// Persisted in WarrantyCase.notes as a JSON blob so we can reverse status on
// COMPLETED / REJECTED without a schema migration. Shape:
//   { originalStatus: { finishedPc?: FinishedPcStatus, component?: ComponentStatus },
//     componentId?: string, salesOrderId?: string, freeform?: string }
export interface WarrantyMeta {
  originalStatus?: {
    finishedPc?: FinishedPcStatus;
    component?: ComponentStatus;
  };
  componentId?: string;
  salesOrderId?: string;
  freeform?: string;
}

function parseMeta(raw: string | null | undefined): WarrantyMeta {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    if (v && typeof v === "object") return v as WarrantyMeta;
    return { freeform: raw };
  } catch {
    return { freeform: raw };
  }
}

function stringifyMeta(meta: WarrantyMeta): string {
  return JSON.stringify(meta);
}

@Injectable()
export class WarrantiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codes: CodeGeneratorService,
    private readonly audit: AuditLogService,
    private readonly stock: StockTransactionService,
    private readonly ctx: RequestContextService,
  ) {}

  async list(q: QueryWarrantyDto) {
    const where: Prisma.WarrantyCaseWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.customerId) where.customerId = q.customerId;
    if (q.fromDate || q.toDate) {
      where.createdAt = {};
      if (q.fromDate) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(q.fromDate);
      if (q.toDate) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(q.toDate);
    }
    if (q.search) {
      where.OR = [
        { code: { contains: q.search, mode: "insensitive" } },
        { finishedPc: { code: { contains: q.search, mode: "insensitive" } } },
        { items: { some: { OR: [
          { removedComponent: { code: { contains: q.search, mode: "insensitive" } } },
          { removedComponent: { serialNumber: { contains: q.search, mode: "insensitive" } } },
          { replacementComponent: { code: { contains: q.search, mode: "insensitive" } } },
        ] } } },
      ];
    }
    const { take, skip } = buildPagination(q.page, q.pageSize);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.warrantyCase.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          finishedPc: { select: { id: true, code: true, status: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      this.prisma.warrantyCase.count({ where }),
    ]);
    return paginate(items, total, q.page ?? 1, q.pageSize ?? 20);
  }

  async get(id: string) {
    const item = await this.prisma.warrantyCase.findUnique({
      where: { id },
      include: {
        customer: true,
        finishedPc: { select: { id: true, code: true, status: true } },
        items: {
          include: {
            removedComponent: {
              select: { id: true, code: true, serialNumber: true, model: true, category: { select: { code: true } } },
            },
            replacementComponent: {
              select: { id: true, code: true, serialNumber: true, model: true, category: { select: { code: true } } },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!item) {
      throw new NotFoundException({
        code: "WARRANTY_NOT_FOUND",
        message: "Warranty case not found",
      });
    }
    const meta = parseMeta(item.resolution);
    const timeline = await this.prisma.auditLog.findMany({
      where: { entityType: "WarrantyCase", entityId: id },
      orderBy: { createdAt: "asc" },
      select: { id: true, action: true, createdAt: true, actorUserId: true, beforeJson: true, afterJson: true },
    });
    let relatedComponent = null as null | { id: string; code: string; serialNumber: string | null; status: ComponentStatus };
    if (meta.componentId) {
      const c = await this.prisma.component.findUnique({
        where: { id: meta.componentId },
        select: { id: true, code: true, serialNumber: true, status: true },
      });
      relatedComponent = c;
    }
    return {
      ...item,
      meta,
      relatedComponent,
      timeline,
    };
  }

  async create(dto: CreateWarrantyDto) {
    if (!dto.finishedPcId && !dto.componentId) {
      throw new BusinessError(
        "WARRANTY_TARGET_REQUIRED",
        "Either finishedPcId or componentId is required",
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({ where: { id: dto.customerId } });
      if (!customer) {
        throw new BusinessError(
          "CUSTOMER_NOT_FOUND",
          `Customer ${dto.customerId} not found`,
          HttpStatus.NOT_FOUND,
        );
      }

      const meta: WarrantyMeta = { originalStatus: {} };
      if (dto.salesOrderId) meta.salesOrderId = dto.salesOrderId;
      if (dto.notes) meta.freeform = dto.notes;

      let pc = null as null | { id: string; code: string; status: FinishedPcStatus };
      if (dto.finishedPcId) {
        const found = await tx.finishedPc.findUnique({
          where: { id: dto.finishedPcId },
          select: { id: true, code: true, status: true },
        });
        if (!found) {
          throw new BusinessError(
            "FINISHED_PC_NOT_FOUND",
            `Finished PC ${dto.finishedPcId} not found`,
            HttpStatus.NOT_FOUND,
          );
        }
        if (found.status !== FinishedPcStatus.SOLD && found.status !== FinishedPcStatus.WARRANTY) {
          throw new BusinessError(
            "FINISHED_PC_NOT_WARRANTABLE",
            `Finished PC ${found.code} is ${found.status}; must be SOLD or WARRANTY`,
            HttpStatus.CONFLICT,
          );
        }
        meta.originalStatus!.finishedPc = found.status;
        pc = found;
      }

      let comp = null as null | { id: string; code: string; status: ComponentStatus };
      if (dto.componentId) {
        const found = await tx.component.findUnique({
          where: { id: dto.componentId },
          select: { id: true, code: true, status: true },
        });
        if (!found) {
          throw new BusinessError(
            "COMPONENT_NOT_FOUND",
            `Component ${dto.componentId} not found`,
            HttpStatus.NOT_FOUND,
          );
        }
        if (found.status !== ComponentStatus.SOLD && found.status !== ComponentStatus.WARRANTY) {
          throw new BusinessError(
            "COMPONENT_NOT_WARRANTABLE",
            `Component ${found.code} is ${found.status}; must be SOLD or WARRANTY`,
            HttpStatus.CONFLICT,
          );
        }
        meta.originalStatus!.component = found.status;
        meta.componentId = found.id;
        comp = found;
      }

      const code = await this.codes.next("WC", tx, 6);
      const created = await tx.warrantyCase.create({
        data: {
          code,
          customerId: dto.customerId,
          finishedPcId: pc?.id ?? null,
          status: WarrantyStatus.RECEIVED,
          description: dto.issue,
          receivedAt: dto.receivedAt ? new Date(dto.receivedAt) : new Date(),
          resolution: stringifyMeta(meta),
          createdById: this.ctx.getUserId() ?? null,
        },
      });

      if (pc && pc.status !== FinishedPcStatus.WARRANTY) {
        await tx.finishedPc.update({
          where: { id: pc.id },
          data: { status: FinishedPcStatus.WARRANTY },
        });
      }
      if (comp && comp.status !== ComponentStatus.WARRANTY) {
        await this.stock.create(
          {
            componentId: comp.id,
            type: StockTxnType.ADJUSTMENT,
            reason: `Warranty case ${code} opened`,
            refType: "WARRANTY_CASE",
            refId: created.id,
            newComponentStatus: ComponentStatus.WARRANTY,
          },
          tx,
        );
      }

      await this.audit.record(
        {
          action: "warranty.create",
          entityType: "WarrantyCase",
          entityId: created.id,
          after: created,
        },
        tx,
      );
      return created;
    });
  }

  async transition(id: string, dto: TransitionWarrantyDto) {
    const before = await this.prisma.warrantyCase.findUnique({ where: { id } });
    if (!before) {
      throw new NotFoundException({ code: "WARRANTY_NOT_FOUND", message: "Warranty case not found" });
    }
    const allowed = WARRANTY_TRANSITIONS[before.status] ?? [];
    if (!allowed.includes(dto.to)) {
      throw new BusinessError(
        "INVALID_STATUS_TRANSITION",
        `Cannot transition ${before.status} -> ${dto.to}`,
        HttpStatus.CONFLICT,
      );
    }
    const isTerminal = dto.to === WarrantyStatus.COMPLETED || dto.to === WarrantyStatus.REJECTED;
    return this.prisma.$transaction(async (tx) => {
      const meta = parseMeta(before.resolution);
      if (dto.notes) {
        meta.freeform = meta.freeform ? `${meta.freeform}\n${dto.notes}` : dto.notes;
      }
      const after = await tx.warrantyCase.update({
        where: { id },
        data: {
          status: dto.to,
          resolution: stringifyMeta(meta),
          completedAt: isTerminal ? new Date() : before.completedAt,
        },
      });
      if (isTerminal) {
        await this.revertRelatedEntities(tx, before.id, before.finishedPcId, meta);
      }
      await this.audit.record(
        {
          action: "warranty.status",
          entityType: "WarrantyCase",
          entityId: id,
          before,
          after,
        },
        tx,
      );
      return after;
    });
  }

  async cancel(id: string) {
    const before = await this.prisma.warrantyCase.findUnique({ where: { id } });
    if (!before) {
      throw new NotFoundException({ code: "WARRANTY_NOT_FOUND", message: "Warranty case not found" });
    }
    if (before.status !== WarrantyStatus.RECEIVED) {
      throw new BusinessError(
        "INVALID_STATUS_TRANSITION",
        `Cannot cancel warranty in status ${before.status}`,
        HttpStatus.CONFLICT,
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const meta = parseMeta(before.resolution);
      const after = await tx.warrantyCase.update({
        where: { id },
        data: { status: WarrantyStatus.REJECTED, completedAt: new Date() },
      });
      await this.revertRelatedEntities(tx, before.id, before.finishedPcId, meta);
      await this.audit.record(
        {
          action: "warranty.cancel",
          entityType: "WarrantyCase",
          entityId: id,
          before,
          after,
        },
        tx,
      );
      return after;
    });
  }

  private async revertRelatedEntities(
    tx: Prisma.TransactionClient,
    warrantyCaseId: string,
    finishedPcId: string | null,
    meta: WarrantyMeta,
  ) {
    if (finishedPcId) {
      const target = meta.originalStatus?.finishedPc ?? FinishedPcStatus.SOLD;
      await tx.finishedPc.updateMany({
        where: { id: finishedPcId, status: FinishedPcStatus.WARRANTY },
        data: { status: target },
      });
    }
    if (meta.componentId) {
      const target = meta.originalStatus?.component ?? ComponentStatus.SOLD;
      const c = await tx.component.findUnique({ where: { id: meta.componentId } });
      if (c && c.status === ComponentStatus.WARRANTY) {
        await this.stock.create(
          {
            componentId: c.id,
            type: StockTxnType.ADJUSTMENT,
            reason: `Warranty case ${warrantyCaseId} closed`,
            refType: "WARRANTY_CASE",
            refId: warrantyCaseId,
            newComponentStatus: target,
          },
          tx,
        );
      }
    }
  }

  async replaceComponent(id: string, dto: ReplaceComponentDto) {
    const wc = await this.prisma.warrantyCase.findUnique({ where: { id } });
    if (!wc) {
      throw new NotFoundException({ code: "WARRANTY_NOT_FOUND", message: "Warranty case not found" });
    }
    if (wc.status === WarrantyStatus.COMPLETED || wc.status === WarrantyStatus.REJECTED) {
      throw new BusinessError(
        "INVALID_STATUS",
        `Cannot replace component on warranty in status ${wc.status}`,
        HttpStatus.CONFLICT,
      );
    }
    if (!wc.finishedPcId) {
      throw new BusinessError(
        "FINISHED_PC_REQUIRED",
        "Component replacement requires a finished PC on the warranty case",
        HttpStatus.CONFLICT,
      );
    }
    if (dto.removedComponentId === dto.replacementComponentId) {
      throw new BusinessError(
        "INVALID_REPLACEMENT",
        "Replacement and removed components must differ",
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const link = await tx.finishedPcComponent.findFirst({
        where: { finishedPcId: wc.finishedPcId!, componentId: dto.removedComponentId, removedAt: null },
      });
      if (!link) {
        throw new BusinessError(
          "COMPONENT_NOT_INSTALLED",
          "Removed component is not currently installed on this finished PC",
          HttpStatus.CONFLICT,
        );
      }
      const removed = await tx.component.findUnique({
        where: { id: dto.removedComponentId },
        select: { id: true, code: true, status: true, categoryId: true },
      });
      const replacement = await tx.component.findUnique({
        where: { id: dto.replacementComponentId },
        select: { id: true, code: true, status: true, categoryId: true, costPrice: true },
      });
      if (!removed || !replacement) {
        throw new BusinessError(
          "COMPONENT_NOT_FOUND",
          "Component not found",
          HttpStatus.NOT_FOUND,
        );
      }
      if (replacement.status !== ComponentStatus.IN_STOCK) {
        throw new BusinessError(
          "REPLACEMENT_NOT_AVAILABLE",
          `Replacement component ${replacement.code} is ${replacement.status}, must be IN_STOCK`,
          HttpStatus.CONFLICT,
        );
      }
      if (replacement.categoryId !== removed.categoryId) {
        throw new BusinessError(
          "INCOMPATIBLE_CATEGORY",
          "Replacement category does not match removed component",
          HttpStatus.CONFLICT,
        );
      }

      // Mark removed component as DEFECTIVE (broken from the customer PC).
      await this.stock.create(
        {
          componentId: removed.id,
          type: StockTxnType.IN,
          reason: `Warranty ${wc.code}: removed from PC`,
          refType: "WARRANTY_CASE",
          refId: wc.id,
          newComponentStatus: ComponentStatus.DEFECTIVE,
        },
        tx,
      );
      // Pull replacement OUT of stock, send to customer's PC. Mirror semantics of
      // a sale: ASSEMBLED (installed) then SOLD because the warranty PC is SOLD.
      await this.stock.create(
        {
          componentId: replacement.id,
          type: StockTxnType.OUT,
          reason: `Warranty ${wc.code}: installed in customer PC`,
          refType: "WARRANTY_CASE",
          refId: wc.id,
          newComponentStatus: ComponentStatus.SOLD,
        },
        tx,
      );

      const now = new Date();
      await tx.finishedPcComponent.update({
        where: { id: link.id },
        data: { removedAt: now },
      });
      await tx.finishedPcComponent.create({
        data: {
          finishedPcId: wc.finishedPcId!,
          componentId: replacement.id,
          installedAt: now,
          notes: `Replaced via warranty ${wc.code}`,
        },
      });
      await tx.component.update({
        where: { id: removed.id },
        data: { currentFinishedPcId: null },
      });
      await tx.component.update({
        where: { id: replacement.id },
        data: { currentFinishedPcId: wc.finishedPcId },
      });
      const item = await tx.warrantyItem.create({
        data: {
          warrantyCaseId: wc.id,
          removedComponentId: removed.id,
          replacementComponentId: replacement.id,
          notes: dto.notes ?? null,
        },
      });

      await this.audit.record(
        {
          action: "warranty.replace_component",
          entityType: "WarrantyCase",
          entityId: wc.id,
          after: {
            warrantyItemId: item.id,
            removedComponentId: removed.id,
            replacementComponentId: replacement.id,
          },
        },
        tx,
      );
      return item;
    });
  }
}
