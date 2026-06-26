import { Injectable, NotFoundException } from "@nestjs/common";
import {
  ComponentStatus,
  MachineStatus,
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
import { QueryMachineDto } from "./dto/query-machine.dto";
import { InspectMachineDto } from "./dto/inspect-machine.dto";
import { AllocateCostDto } from "./dto/allocate-cost.dto";

@Injectable()
export class MachinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codes: CodeGeneratorService,
    private readonly audit: AuditLogService,
    private readonly stock: StockTransactionService,
    private readonly ctx: RequestContextService,
  ) {}

  async list(q: QueryMachineDto) {
    const where: Prisma.MachineWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.serial) where.serial = { contains: q.serial, mode: "insensitive" };
    if (q.search) {
      where.OR = [
        { code: { contains: q.search, mode: "insensitive" } },
        { serial: { contains: q.search, mode: "insensitive" } },
      ];
    }
    const { take, skip } = buildPagination(q.page, q.pageSize);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.machine.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { machineComponents: true, sourcedComponents: true } } },
        take,
        skip,
      }),
      this.prisma.machine.count({ where }),
    ]);
    return paginate(items, total, q.page ?? 1, q.pageSize ?? 20);
  }

  async get(id: string) {
    const item = await this.prisma.machine.findUnique({
      where: { id },
      include: {
        machineComponents: { include: { category: true, component: true } },
        sourcedComponents: { include: { category: true } },
        purchaseItem: { include: { purchaseOrder: true } },
      },
    });
    if (!item) throw new NotFoundException({ code: "MACHINE_NOT_FOUND", message: "Machine not found" });
    return item;
  }

  async inspect(id: string, dto: InspectMachineDto) {
    const before = await this.prisma.machine.findUnique({
      where: { id },
      include: { machineComponents: true },
    });
    if (!before) throw new NotFoundException({ code: "MACHINE_NOT_FOUND", message: "Machine not found" });
    if (before.status !== MachineStatus.NEW) {
      throw new BusinessError(
        "INVALID_STATUS_TRANSITION",
        `Cannot inspect machine in status ${before.status}`,
        409 as any,
      );
    }
    return this.prisma.$transaction(async (tx) => {
      // Wipe any prior MachineComponent rows in case inspect is re-run (still NEW).
      await tx.machineComponent.deleteMany({ where: { machineId: id, componentId: null } });

      for (const c of dto.components) {
        const category = await tx.componentCategory.findUnique({ where: { code: c.categoryCode } });
        if (!category) {
          throw new BusinessError(
            "COMPONENT_CATEGORY_NOT_FOUND",
            `Category ${c.categoryCode} not found`,
          );
        }
        await tx.machineComponent.create({
          data: {
            machineId: id,
            categoryId: category.id,
            model: c.model ?? null,
            serial: c.serial ?? null,
            condition: c.condition,
            notes: c.notes ?? null,
          },
        });
      }

      const after = await tx.machine.update({
        where: { id },
        data: {
          status: MachineStatus.CHECKED,
          inspectedAt: new Date(),
          notes: dto.notes ?? before.notes,
        },
      });

      await this.audit.record(
        { action: "machine.inspect", entityType: "Machine", entityId: id, before, after },
        tx,
      );
      return tx.machine.findUniqueOrThrow({
        where: { id },
        include: { machineComponents: { include: { category: true } } },
      });
    });
  }

  async allocateCost(id: string, dto: AllocateCostDto) {
    const machine = await this.prisma.machine.findUnique({
      where: { id },
      include: { machineComponents: true },
    });
    if (!machine) throw new NotFoundException({ code: "MACHINE_NOT_FOUND", message: "Machine not found" });
    if (machine.status !== MachineStatus.CHECKED) {
      throw new BusinessError(
        "INVALID_STATUS_TRANSITION",
        `Cannot allocate cost for machine in status ${machine.status}`,
        409 as any,
      );
    }
    const sum = dto.allocations.reduce((s, e) => s + Number(e.costPrice), 0);
    const expected = Number(machine.cost) + Number(machine.repairCost) + Number(machine.cleaningCost);
    if (Math.abs(sum - expected) > 0.01) {
      throw new BusinessError(
        "COST_ALLOCATION_MISMATCH",
        `Sum of allocated cost (${sum}) must equal machine total cost (${expected})`,
      );
    }
    const componentIds = new Set(machine.machineComponents.map((mc) => mc.id));
    for (const e of dto.allocations) {
      if (!componentIds.has(e.machineComponentId)) {
        throw new BusinessError(
          "INVALID_MACHINE_COMPONENT",
          `MachineComponent ${e.machineComponentId} not in this machine`,
        );
      }
    }
    return this.prisma.$transaction(async (tx) => {
      for (const e of dto.allocations) {
        await tx.machineComponent.update({
          where: { id: e.machineComponentId },
          data: { allocatedCost: e.costPrice },
        });
      }
      const after = await tx.machine.findUniqueOrThrow({
        where: { id },
        include: { machineComponents: true },
      });
      await this.audit.record(
        {
          action: "machine.allocate_cost",
          entityType: "Machine",
          entityId: id,
          before: machine,
          after,
        },
        tx,
      );
      return after;
    });
  }

  async disassemble(id: string) {
    const before = await this.prisma.machine.findUnique({
      where: { id },
      include: { machineComponents: { include: { category: true } } },
    });
    if (!before) throw new NotFoundException({ code: "MACHINE_NOT_FOUND", message: "Machine not found" });
    if (before.status !== MachineStatus.CHECKED) {
      throw new BusinessError(
        "INVALID_STATUS_TRANSITION",
        `Cannot disassemble machine in status ${before.status}`,
        409 as any,
      );
    }
    if (before.machineComponents.length === 0) {
      throw new BusinessError(
        "NO_COMPONENTS_DECLARED",
        "Machine has no declared components",
      );
    }
    return this.prisma.$transaction(async (tx) => {
      for (const mc of before.machineComponents) {
        if (mc.componentId) continue;
        const compCode = await this.codes.next(mc.category.prefix, tx, 6);
        const created = await tx.component.create({
          data: {
            code: compCode,
            categoryId: mc.categoryId,
            status: ComponentStatus.IN_STOCK,
            condition: mc.condition,
            model: mc.model ?? null,
            serialNumber: mc.serial ?? null,
            costPrice: mc.allocatedCost,
            sourceMachineId: before.id,
            createdById: this.ctx.getUserId() ?? null,
            notes: mc.notes ?? null,
          },
        });
        await tx.machineComponent.update({
          where: { id: mc.id },
          data: { componentId: created.id },
        });
        await this.stock.create(
          {
            componentId: created.id,
            type: StockTxnType.IN,
            reason: "Machine disassembly",
            refType: "MACHINE",
            refId: before.id,
          },
          tx,
        );
      }
      const after = await tx.machine.update({
        where: { id },
        data: { status: MachineStatus.DISASSEMBLED, disassembledAt: new Date() },
      });
      await this.audit.record(
        { action: "machine.disassemble", entityType: "Machine", entityId: id, before, after },
        tx,
      );
      return tx.machine.findUniqueOrThrow({
        where: { id },
        include: { sourcedComponents: true },
      });
    });
  }

  async markReadyForSale(id: string) {
    const before = await this.prisma.machine.findUnique({ where: { id } });
    if (!before) throw new NotFoundException({ code: "MACHINE_NOT_FOUND", message: "Machine not found" });
    if (before.status !== MachineStatus.CHECKED) {
      throw new BusinessError(
        "INVALID_STATUS_TRANSITION",
        `Cannot mark ready for sale from status ${before.status}`,
        409 as any,
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const after = await tx.machine.update({
        where: { id },
        data: { status: MachineStatus.READY_FOR_SALE },
      });
      await this.audit.record(
        { action: "machine.ready_for_sale", entityType: "Machine", entityId: id, before, after },
        tx,
      );
      return after;
    });
  }
}
