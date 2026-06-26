import { HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import {
  AssemblyStatus,
  ComponentStatus,
  FinishedPcStatus,
  Prisma,
  StockTxnType,
} from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { CodeGeneratorService } from "../../common/utils/code-generator.service";
import { AuditLogService } from "../audit-logs/audit-logs.service";
import { StockTransactionService } from "../inventory/stock-transaction.service";
import { BusinessError } from "../../common/exceptions/business.exception";
import { RequestContextService } from "../../common/context/request-context.service";
import { buildPagination, paginate } from "../../common/utils/pagination.util";
import { CreateAssemblyDto, AssemblyRole } from "./dto/create-assembly.dto";
import { UpdateAssemblyDto } from "./dto/update-assembly.dto";
import { QueryAssemblyDto } from "./dto/query-assembly.dto";

// AssemblyItem has no role column; role is inferred from Component.category.

@Injectable()
export class AssembliesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codes: CodeGeneratorService,
    private readonly audit: AuditLogService,
    private readonly stock: StockTransactionService,
    private readonly ctx: RequestContextService,
  ) {}

  async list(q: QueryAssemblyDto) {
    const where: Prisma.AssemblyOrderWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.fromDate || q.toDate) {
      where.createdAt = {};
      if (q.fromDate) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(q.fromDate);
      if (q.toDate) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(q.toDate);
    }
    if (q.search) {
      where.OR = [{ code: { contains: q.search, mode: "insensitive" } }];
    }
    const { take, skip } = buildPagination(q.page, q.pageSize);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.assemblyOrder.findMany({
        where,
        include: {
          _count: { select: { items: true } },
          finishedPcs: { select: { id: true, code: true, status: true } },
        },
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      this.prisma.assemblyOrder.count({ where }),
    ]);
    const projected = items.map((a) => ({
      ...a,
      itemCount: a._count.items,
      totalCost:
        Number(a.repairCost) + Number(a.cleaningCost) + Number(a.assemblyCost),
    }));
    return paginate(projected, total, q.page ?? 1, q.pageSize ?? 20);
  }

  async get(id: string, tx?: Prisma.TransactionClient) {
    const client: Prisma.TransactionClient | PrismaService = tx ?? this.prisma;
    const item = await (client as Prisma.TransactionClient).assemblyOrder.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            component: {
              include: { category: true },
            },
          },
        },
        finishedPcs: { select: { id: true, code: true, status: true, costPrice: true } },
      },
    });
    if (!item) {
      throw new NotFoundException({ code: "ASSEMBLY_NOT_FOUND", message: "Assembly order not found" });
    }

    const components = item.items.map((it) => ({
      id: it.id,
      componentId: it.componentId,
      role: this.guessRole(it.component.category.code),
      unitCost: Number(it.unitCost),
      component: {
        id: it.component.id,
        code: it.component.code,
        categoryCode: it.component.category.code,
        model: it.component.model,
        serial: it.component.serialNumber,
        status: it.component.status,
        costPrice: Number(it.component.costPrice),
      },
    }));
    const componentsTotal = components.reduce((s, c) => s + c.unitCost, 0);
    const totalCost =
      componentsTotal + Number(item.repairCost) + Number(item.cleaningCost) + Number(item.assemblyCost);

    return {
      ...item,
      components,
      componentsTotal,
      totalCost,
      draftPcPreview: {
        costPrice: totalCost,
      },
    };
  }

  private guessRole(categoryCode: string): AssemblyRole {
    const r = categoryCode as keyof typeof AssemblyRole;
    if (AssemblyRole[r]) return AssemblyRole[r];
    return AssemblyRole.OTHER;
  }

  async create(dto: CreateAssemblyDto) {
    const componentIds = dto.items.map((i) => i.componentId);
    const dups = componentIds.filter((id, i) => componentIds.indexOf(id) !== i);
    if (dups.length > 0) {
      throw new BusinessError(
        "DUPLICATE_COMPONENT",
        `Duplicate componentId in items: ${dups[0]}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const components = await tx.component.findMany({
        where: { id: { in: componentIds } },
      });
      if (components.length !== componentIds.length) {
        throw new BusinessError(
          "COMPONENT_NOT_FOUND",
          "One or more components not found",
          HttpStatus.NOT_FOUND,
        );
      }
      for (const c of components) {
        if (c.status !== ComponentStatus.IN_STOCK) {
          throw new BusinessError(
            "COMPONENT_NOT_AVAILABLE",
            `Component ${c.code} is ${c.status}, must be IN_STOCK`,
            HttpStatus.CONFLICT,
          );
        }
      }

      const code = await this.codes.next("AO", tx, 6);
      const order = await tx.assemblyOrder.create({
        data: {
          code,
          status: AssemblyStatus.DRAFT,
          repairCost: dto.repairCost ?? 0,
          cleaningCost: dto.cleaningCost ?? 0,
          assemblyCost: dto.assemblyCost ?? 0,
          notes: this.composeNotes(dto.name, dto.notes),
          createdById: this.ctx.getUserId() ?? null,
        },
      });

      const componentById = new Map(components.map((c) => [c.id, c]));
      for (const it of dto.items) {
        const c = componentById.get(it.componentId)!;
        await tx.assemblyItem.create({
          data: {
            assemblyOrderId: order.id,
            componentId: it.componentId,
            unitCost: c.costPrice,
          },
        });
        const reserved = await this.stock.reserveAtomic(
          it.componentId,
          "ASSEMBLY_ORDER",
          order.id,
          tx,
        );
        if (!reserved) {
          throw new BusinessError(
            "COMPONENT_NOT_AVAILABLE",
            `Linh kien ${c.code} khong con kha dung`,
            HttpStatus.CONFLICT,
          );
        }
      }

      await this.audit.record(
        { action: "assembly.create", entityType: "AssemblyOrder", entityId: order.id, after: order },
        tx,
      );

      return this.get(order.id, tx);
    });
  }

  private composeNotes(name?: string, notes?: string): string | null {
    const parts: string[] = [];
    if (name) parts.push(`NAME:${name}`);
    if (notes) parts.push(notes);
    return parts.length > 0 ? parts.join("\n") : null;
  }

  async update(id: string, dto: UpdateAssemblyDto) {
    const before = await this.prisma.assemblyOrder.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!before) {
      throw new NotFoundException({ code: "ASSEMBLY_NOT_FOUND", message: "Assembly order not found" });
    }
    if (
      before.status !== AssemblyStatus.DRAFT &&
      before.status !== AssemblyStatus.IN_PROGRESS
    ) {
      throw new BusinessError(
        "INVALID_STATUS_TRANSITION",
        `Cannot update assembly in status ${before.status}`,
        HttpStatus.CONFLICT,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.items) {
        const newIds = dto.items.map((i) => i.componentId);
        const dups = newIds.filter((x, i) => newIds.indexOf(x) !== i);
        if (dups.length > 0) {
          throw new BusinessError(
            "DUPLICATE_COMPONENT",
            `Duplicate componentId: ${dups[0]}`,
            HttpStatus.BAD_REQUEST,
          );
        }
        const oldIds = before.items.map((i) => i.componentId);
        const toRelease = oldIds.filter((id) => !newIds.includes(id));
        const toReserve = newIds.filter((id) => !oldIds.includes(id));

        const reserveComponents = await tx.component.findMany({
          where: { id: { in: toReserve } },
        });
        for (const c of reserveComponents) {
          if (c.status !== ComponentStatus.IN_STOCK) {
            throw new BusinessError(
              "COMPONENT_NOT_AVAILABLE",
              `Component ${c.code} is ${c.status}, must be IN_STOCK`,
              HttpStatus.CONFLICT,
            );
          }
        }

        for (const cid of toRelease) {
          await this.stock.releaseReservation(
            cid,
            "ASSEMBLY_ORDER",
            id,
            "Removed from assembly draft",
            tx,
          );
        }
        for (const cid of toReserve) {
          const reserved = await this.stock.reserveAtomic(cid, "ASSEMBLY_ORDER", id, tx);
          if (!reserved) {
            throw new BusinessError(
              "COMPONENT_NOT_AVAILABLE",
              `Linh kien ${cid} khong con kha dung`,
              HttpStatus.CONFLICT,
            );
          }
        }

        await tx.assemblyItem.deleteMany({
          where: { assemblyOrderId: id, componentId: { in: toRelease } },
        });
        const reserveById = new Map(reserveComponents.map((c) => [c.id, c]));
        for (const newId of toReserve) {
          const c = reserveById.get(newId)!;
          await tx.assemblyItem.create({
            data: {
              assemblyOrderId: id,
              componentId: newId,
              unitCost: c.costPrice,
            },
          });
        }
      }

      const name = dto.name ?? this.extractName(before.notes);
      const rawNotes = dto.notes ?? this.extractNotes(before.notes);
      const after = await tx.assemblyOrder.update({
        where: { id },
        data: {
          repairCost: dto.repairCost ?? before.repairCost,
          cleaningCost: dto.cleaningCost ?? before.cleaningCost,
          assemblyCost: dto.assemblyCost ?? before.assemblyCost,
          notes: this.composeNotes(name, rawNotes),
        },
      });

      await this.audit.record(
        { action: "assembly.update", entityType: "AssemblyOrder", entityId: id, before, after },
        tx,
      );

      return this.get(id, tx);
    });
  }

  private extractName(notes: string | null | undefined): string | undefined {
    if (!notes) return undefined;
    const m = notes.match(/^NAME:(.+)$/m);
    return m?.[1];
  }
  private extractNotes(notes: string | null | undefined): string | undefined {
    if (!notes) return undefined;
    return notes
      .split("\n")
      .filter((l) => !l.startsWith("NAME:"))
      .join("\n") || undefined;
  }

  async start(id: string) {
    const before = await this.prisma.assemblyOrder.findUnique({ where: { id } });
    if (!before) {
      throw new NotFoundException({ code: "ASSEMBLY_NOT_FOUND", message: "Assembly order not found" });
    }
    if (before.status !== AssemblyStatus.DRAFT) {
      throw new BusinessError(
        "INVALID_STATUS_TRANSITION",
        `Assembly already ${before.status}`,
        HttpStatus.CONFLICT,
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const after = await tx.assemblyOrder.update({
        where: { id },
        data: { status: AssemblyStatus.IN_PROGRESS, startedAt: new Date() },
      });
      await this.audit.record(
        { action: "assembly.start", entityType: "AssemblyOrder", entityId: id, before, after },
        tx,
      );
      return this.get(id, tx);
    });
  }

  async complete(id: string) {
    const before = await this.prisma.assemblyOrder.findUnique({
      where: { id },
      include: {
        items: { include: { component: { include: { category: true } } } },
      },
    });
    if (!before) {
      throw new NotFoundException({ code: "ASSEMBLY_NOT_FOUND", message: "Assembly order not found" });
    }
    if (before.status !== AssemblyStatus.IN_PROGRESS) {
      throw new BusinessError(
        "INVALID_STATUS_TRANSITION",
        `Cannot complete assembly in status ${before.status}`,
        HttpStatus.CONFLICT,
      );
    }
    const categoryCodes = before.items.map((i) => i.component.category.code);
    if (!categoryCodes.includes("CPU")) {
      throw new BusinessError(
        "MISSING_REQUIRED_COMPONENT",
        "Assembly must include at least one CPU",
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!categoryCodes.includes("MB")) {
      throw new BusinessError(
        "MISSING_REQUIRED_COMPONENT",
        "Assembly must include at least one MB (mainboard)",
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const componentsCostTotal = before.items.reduce(
        (s, it) => s + Number(it.component.costPrice),
        0,
      );
      const costPrice =
        componentsCostTotal +
        Number(before.repairCost) +
        Number(before.cleaningCost) +
        Number(before.assemblyCost);

      const pcCode = await this.codes.next("PC", tx, 6);
      const pc = await tx.finishedPc.create({
        data: {
          code: pcCode,
          assemblyOrderId: before.id,
          status: FinishedPcStatus.ASSEMBLING,
          costPrice,
          suggestedPrice: 0,
          createdById: this.ctx.getUserId() ?? null,
        },
      });

      for (const it of before.items) {
        await tx.finishedPcComponent.create({
          data: {
            finishedPcId: pc.id,
            componentId: it.componentId,
            installedAt: new Date(),
          },
        });
        await this.stock.create(
          {
            componentId: it.componentId,
            type: StockTxnType.OUT,
            reason: `Assembled into ${pcCode}`,
            refType: "ASSEMBLY_ORDER",
            refId: before.id,
            newComponentStatus: ComponentStatus.ASSEMBLED,
          },
          tx,
        );
        await tx.component.update({
          where: { id: it.componentId },
          data: { currentFinishedPcId: pc.id },
        });
      }

      const after = await tx.assemblyOrder.update({
        where: { id },
        data: { status: AssemblyStatus.COMPLETED, completedAt: new Date() },
      });

      await this.audit.record(
        {
          action: "assembly.complete",
          entityType: "AssemblyOrder",
          entityId: id,
          before,
          after: { ...after, finishedPcId: pc.id, finishedPcCode: pc.code, costPrice },
        },
        tx,
      );

      return this.get(id, tx);
    });
  }

  async cancel(id: string) {
    const before = await this.prisma.assemblyOrder.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!before) {
      throw new NotFoundException({ code: "ASSEMBLY_NOT_FOUND", message: "Assembly order not found" });
    }
    if (
      before.status !== AssemblyStatus.DRAFT &&
      before.status !== AssemblyStatus.IN_PROGRESS
    ) {
      throw new BusinessError(
        "INVALID_STATUS_TRANSITION",
        `Cannot cancel assembly in status ${before.status}`,
        HttpStatus.CONFLICT,
      );
    }
    return this.prisma.$transaction(async (tx) => {
      for (const it of before.items) {
        await this.stock.releaseReservation(
          it.componentId,
          "ASSEMBLY_ORDER",
          id,
          "Assembly cancelled",
          tx,
        );
      }
      const after = await tx.assemblyOrder.update({
        where: { id },
        data: { status: AssemblyStatus.CANCELLED },
      });
      await this.audit.record(
        { action: "assembly.cancel", entityType: "AssemblyOrder", entityId: id, before, after },
        tx,
      );
      return this.get(id, tx);
    });
  }
}
