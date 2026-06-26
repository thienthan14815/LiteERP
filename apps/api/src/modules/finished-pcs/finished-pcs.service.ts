import { HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import {
  ComponentStatus,
  FinishedPcStatus,
  Prisma,
  StockTxnType,
} from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { AuditLogService } from "../audit-logs/audit-logs.service";
import { StockTransactionService } from "../inventory/stock-transaction.service";
import { BusinessError } from "../../common/exceptions/business.exception";
import { buildPagination, paginate } from "../../common/utils/pagination.util";
import { QueryFinishedPcDto } from "./dto/query-finished-pc.dto";
import { UpdateFinishedPcDto } from "./dto/update-finished-pc.dto";
import {
  TransitionFinishedPcDto,
  TRANSITIONS_ALLOWED,
} from "./dto/transition-finished-pc.dto";

@Injectable()
export class FinishedPcsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly stock: StockTransactionService,
  ) {}

  async list(q: QueryFinishedPcDto) {
    const where: Prisma.FinishedPcWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.search) {
      where.OR = [{ code: { contains: q.search, mode: "insensitive" } }];
    }
    const { take, skip } = buildPagination(q.page, q.pageSize);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.finishedPc.findMany({
        where,
        include: {
          _count: { select: { currentComponents: true } },
          assemblyOrder: { select: { id: true, code: true } },
        },
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      this.prisma.finishedPc.count({ where }),
    ]);
    const projected = items.map((pc) => ({
      ...pc,
      componentCount: pc._count.currentComponents,
    }));
    return paginate(projected, total, q.page ?? 1, q.pageSize ?? 20);
  }

  async get(id: string) {
    const item = await this.prisma.finishedPc.findUnique({
      where: { id },
      include: {
        assemblyOrder: { select: { id: true, code: true, status: true } },
        componentLinks: {
          include: {
            component: { include: { category: true } },
          },
          orderBy: { installedAt: "desc" },
        },
        currentComponents: { include: { category: true } },
        salesItems: {
          include: { salesOrder: { select: { id: true, code: true, status: true, confirmedAt: true } } },
        },
      },
    });
    if (!item) {
      throw new NotFoundException({ code: "FINISHED_PC_NOT_FOUND", message: "Finished PC not found" });
    }

    const currentComponents = item.currentComponents.map((c) => ({
      id: c.id,
      code: c.code,
      categoryCode: c.category.code,
      model: c.model,
      serial: c.serialNumber,
      status: c.status,
      costPrice: Number(c.costPrice),
    }));
    const componentHistory = item.componentLinks.map((l) => ({
      id: l.id,
      componentId: l.componentId,
      componentCode: l.component.code,
      categoryCode: l.component.category.code,
      model: l.component.model,
      serial: l.component.serialNumber,
      installedAt: l.installedAt,
      removedAt: l.removedAt,
      isCurrent: l.removedAt === null,
    }));

    return {
      ...item,
      currentComponents,
      componentHistory,
      // Repair history will be wired in Phase 3 (warranty/repair).
      repairHistory: [] as Array<unknown>,
    };
  }

  async update(id: string, dto: UpdateFinishedPcDto) {
    const before = await this.prisma.finishedPc.findUnique({ where: { id } });
    if (!before) {
      throw new NotFoundException({ code: "FINISHED_PC_NOT_FOUND", message: "Finished PC not found" });
    }
    if (before.status === FinishedPcStatus.SOLD || before.status === FinishedPcStatus.SCRAPPED) {
      throw new BusinessError(
        "INVALID_STATUS_TRANSITION",
        `Cannot edit finished PC in status ${before.status}`,
        HttpStatus.CONFLICT,
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const after = await tx.finishedPc.update({
        where: { id },
        data: {
          suggestedPrice: dto.suggestedPrice ?? before.suggestedPrice,
          notes: dto.notes ?? before.notes,
        },
      });
      await this.audit.record(
        { action: "finished_pc.update", entityType: "FinishedPc", entityId: id, before, after },
        tx,
      );
      return after;
    });
  }

  async transition(id: string, dto: TransitionFinishedPcDto) {
    const before = await this.prisma.finishedPc.findUnique({ where: { id } });
    if (!before) {
      throw new NotFoundException({ code: "FINISHED_PC_NOT_FOUND", message: "Finished PC not found" });
    }
    const allowed = TRANSITIONS_ALLOWED[before.status] ?? [];
    if (!allowed.includes(dto.to as FinishedPcStatus)) {
      throw new BusinessError(
        "INVALID_STATUS_TRANSITION",
        `Cannot transition ${before.status} -> ${dto.to}`,
        HttpStatus.CONFLICT,
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const after = await tx.finishedPc.update({
        where: { id },
        data: {
          status: dto.to as FinishedPcStatus,
          readyAt: dto.to === "READY_FOR_SALE" ? new Date() : before.readyAt,
        },
      });
      await this.audit.record(
        {
          action: "finished_pc.transition",
          entityType: "FinishedPc",
          entityId: id,
          before,
          after,
        },
        tx,
      );
      return after;
    });
  }

  async scrap(id: string) {
    const before = await this.prisma.finishedPc.findUnique({
      where: { id },
      include: { currentComponents: true },
    });
    if (!before) {
      throw new NotFoundException({ code: "FINISHED_PC_NOT_FOUND", message: "Finished PC not found" });
    }
    if (before.status === FinishedPcStatus.SOLD || before.status === FinishedPcStatus.SCRAPPED) {
      throw new BusinessError(
        "INVALID_STATUS_TRANSITION",
        `Cannot scrap finished PC in status ${before.status}`,
        HttpStatus.CONFLICT,
      );
    }
    return this.prisma.$transaction(async (tx) => {
      for (const c of before.currentComponents) {
        await this.stock.create(
          {
            componentId: c.id,
            type: StockTxnType.SCRAP,
            reason: `Finished PC ${before.code} scrapped`,
            refType: "FINISHED_PC",
            refId: id,
            newComponentStatus: ComponentStatus.SCRAPPED,
          },
          tx,
        );
        await tx.finishedPcComponent.updateMany({
          where: { finishedPcId: id, componentId: c.id, removedAt: null },
          data: { removedAt: new Date() },
        });
        await tx.component.update({
          where: { id: c.id },
          data: { currentFinishedPcId: null },
        });
      }
      const after = await tx.finishedPc.update({
        where: { id },
        data: { status: FinishedPcStatus.SCRAPPED },
      });
      await this.audit.record(
        { action: "finished_pc.scrap", entityType: "FinishedPc", entityId: id, before, after },
        tx,
      );
      return after;
    });
  }
}
