import { HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
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
import { UpdateMachineDto } from "./dto/update-machine.dto";

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
    // Alias `cost` → `purchasePrice` để UI (page list + detail) khớp field name.
    const projected = items.map((m) => ({ ...m, purchasePrice: Number(m.cost) }));
    return paginate(projected, total, q.page ?? 1, q.pageSize ?? 20);
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
    // Alias `cost` → `purchasePrice` để khớp UI (schema dùng `cost` từ Phase 0,
    // nhưng UI + docs gọi là "giá mua").
    return { ...item, purchasePrice: Number(item.cost) };
  }

  async update(id: string, dto: UpdateMachineDto) {
    const before = await this.prisma.machine.findUnique({ where: { id } });
    if (!before) {
      throw new NotFoundException({ code: "MACHINE_NOT_FOUND", message: "Machine not found" });
    }
    // Chỉ chặn edit khi máy đã bán/thanh lý — các state khác cho sửa metadata.
    if (before.status === MachineStatus.SOLD || before.status === MachineStatus.SCRAP) {
      throw new BusinessError(
        "INVALID_STATUS_FOR_EDIT",
        `Cannot edit machine in status ${before.status}`,
        HttpStatus.CONFLICT,
      );
    }
    await this.prisma.$transaction(async (tx) => {
      const data: Prisma.MachineUpdateInput = {};
      if (dto.serial !== undefined) data.serial = dto.serial.trim() || null;
      if (dto.notes !== undefined) data.notes = dto.notes.trim() || null;
      if (dto.purchasePrice !== undefined) data.cost = dto.purchasePrice;
      const after = await tx.machine.update({ where: { id }, data });
      await this.audit.record(
        {
          action: "machine.update",
          entityType: "Machine",
          entityId: id,
          before,
          after,
        },
        tx,
      );
    });
    // Fetch sau khi tx đã commit — get() dùng this.prisma nên trước commit sẽ
    // đọc snapshot cũ; phải gọi sau `await $transaction(...)`.
    return this.get(id);
  }

  async inspect(id: string, dto: InspectMachineDto) {
    const before = await this.prisma.machine.findUnique({
      where: { id },
      include: { machineComponents: true },
    });
    if (!before) throw new NotFoundException({ code: "MACHINE_NOT_FOUND", message: "Machine not found" });
    // Cho phép re-inspect khi máy đang ở NEW hoặc CHECKED (sửa kết quả kiểm tra).
    // Không cho phép khi đã DISASSEMBLED / READY_FOR_SALE / SOLD / SCRAP —
    // lúc đó linh kiện đã vào kho, thay đổi sẽ phá tính nhất quán tồn kho.
    if (
      before.status !== MachineStatus.NEW &&
      before.status !== MachineStatus.CHECKED
    ) {
      throw new BusinessError(
        "INVALID_STATUS_TRANSITION",
        `Không thể kiểm tra lại máy ở trạng thái ${before.status}. Chỉ cho phép NEW hoặc CHECKED.`,
        HttpStatus.CONFLICT,
      );
    }
    return this.prisma.$transaction(async (tx) => {
      // Wipe MachineComponent cũ để re-inspect ghi đè kết quả. Cần đảm bảo
      // KHÔNG có linh kiện nào đã link ra Component thật (tức đã tháo máy)
      // — check trên bằng status guard đã đảm bảo trạng thái CHECKED không có
      // componentId gắn (chỉ DISASSEMBLED mới có).
      await tx.machineComponent.deleteMany({ where: { machineId: id } });

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
      include: { machineComponents: { include: { category: true } } },
    });
    if (!machine) throw new NotFoundException({ code: "MACHINE_NOT_FOUND", message: "Machine not found" });
    if (machine.status !== MachineStatus.CHECKED) {
      throw new BusinessError(
        "INVALID_STATUS_TRANSITION",
        `Không thể phân bổ giá vốn khi máy ở trạng thái ${machine.status}. Chỉ cho phép CHECKED.`,
        HttpStatus.CONFLICT,
      );
    }
    if (machine.machineComponents.length === 0) {
      throw new BusinessError(
        "NO_COMPONENTS_TO_ALLOCATE",
        "Máy chưa có linh kiện — thực hiện Kiểm tra trước khi phân bổ giá vốn.",
        HttpStatus.CONFLICT,
      );
    }

    const totalAllocated = dto.items.reduce((s, e) => s + Number(e.cost), 0);
    // So sánh với giá mua máy (Machine.cost). Repair/cleaning cost xử lý
    // riêng ở step khác; ở đây chỉ phân bổ giá mua vào từng linh kiện để
    // sau tháo máy mỗi Component có giá vốn hợp lý.
    const expected = Number(machine.cost);
    if (Math.abs(totalAllocated - expected) > 1) {
      throw new BusinessError(
        "COST_ALLOCATION_MISMATCH",
        `Tổng giá vốn phân bổ (${totalAllocated}) phải bằng giá mua máy (${expected}).`,
      );
    }

    // Map categoryCode → tất cả MachineComponent thuộc category đó.
    const byCategory = new Map<string, typeof machine.machineComponents>();
    for (const mc of machine.machineComponents) {
      const code = mc.category.code;
      const arr = byCategory.get(code) ?? [];
      arr.push(mc);
      byCategory.set(code, arr);
    }

    // Validate mọi categoryCode trong items thực sự có trong máy.
    for (const it of dto.items) {
      if (!byCategory.has(it.categoryCode)) {
        throw new BusinessError(
          "INVALID_ALLOCATION_CATEGORY",
          `Máy không có linh kiện loại ${it.categoryCode}.`,
        );
      }
    }

    // Trong 1 category có N linh kiện — chia đều `cost` cho từng linh kiện.
    // Ví dụ: 2 thanh RAM, cost=1000 → mỗi thanh nhận 500.
    const updates: Array<{ id: string; cost: number }> = [];
    for (const it of dto.items) {
      const rows = byCategory.get(it.categoryCode)!;
      const each = Number(it.cost) / rows.length;
      for (const mc of rows) {
        updates.push({ id: mc.id, cost: each });
      }
    }

    await this.prisma.$transaction(async (tx) => {
      // Reset trước: các category KHÔNG có trong items → cost = 0.
      const allocatedCategories = new Set(dto.items.map((i) => i.categoryCode));
      for (const mc of machine.machineComponents) {
        if (!allocatedCategories.has(mc.category.code)) {
          await tx.machineComponent.update({
            where: { id: mc.id },
            data: { allocatedCost: 0 },
          });
        }
      }
      for (const u of updates) {
        await tx.machineComponent.update({
          where: { id: u.id },
          data: { allocatedCost: u.cost },
        });
      }
      await this.audit.record(
        {
          action: "machine.allocate_cost",
          entityType: "Machine",
          entityId: id,
          before: machine,
          after: { items: dto.items, totalAllocated, expected },
        },
        tx,
      );
    });
    return this.get(id);
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
        HttpStatus.CONFLICT,
      );
    }
    if (before.machineComponents.length === 0) {
      throw new BusinessError(
        "NO_COMPONENTS_DECLARED",
        "Máy chưa khai báo linh kiện nào trong bước kiểm tra.",
      );
    }
    // Slot được coi là "rỗng" khi user chỉ chọn category mà không nhập
    // model + serial + notes → không đại diện linh kiện thật → skip khi tháo.
    const isEmptySlot = (mc: (typeof before.machineComponents)[number]): boolean =>
      !mc.model?.trim() && !mc.serial?.trim() && !mc.notes?.trim();
    const eligible = before.machineComponents.filter((mc) => !isEmptySlot(mc));
    if (eligible.length === 0) {
      throw new BusinessError(
        "NO_COMPONENTS_TO_DISASSEMBLE",
        "Tất cả slot linh kiện đều rỗng (chưa nhập model/serial). Không có gì để xuất vào kho.",
      );
    }
    return this.prisma.$transaction(async (tx) => {
      let created = 0;
      let skipped = 0;
      for (const mc of before.machineComponents) {
        if (mc.componentId) {
          skipped++;
          continue;
        }
        if (isEmptySlot(mc)) {
          skipped++;
          continue; // Rule mới: slot rỗng → không xuất vào kho
        }
        const compCode = await this.codes.next(mc.category.prefix, tx, 6);
        const newComp = await tx.component.create({
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
          data: { componentId: newComp.id },
        });
        await this.stock.create(
          {
            componentId: newComp.id,
            type: StockTxnType.IN,
            reason: "Machine disassembly",
            refType: "MACHINE",
            refId: before.id,
          },
          tx,
        );
        created++;
      }
      const after = await tx.machine.update({
        where: { id },
        data: { status: MachineStatus.DISASSEMBLED, disassembledAt: new Date() },
      });
      await this.audit.record(
        {
          action: "machine.disassemble",
          entityType: "Machine",
          entityId: id,
          before,
          after: { ...after, componentsCreated: created, slotsSkipped: skipped },
        },
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
        HttpStatus.CONFLICT,
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
