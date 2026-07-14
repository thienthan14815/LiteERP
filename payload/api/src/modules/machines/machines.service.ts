import { HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, inArray, like, or, sql, type SQL } from "drizzle-orm";
import {
  ComponentStatus,
  MachineStatus,
  StockTxnType,
} from "@app/shared";
import { DbService } from "../../database/db.service";
import {
  componentCategories,
  components,
  machineComponents,
  machines,
} from "../../database/schema";
import { createId } from "../../database/id";
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
    private readonly dbs: DbService,
    private readonly codes: CodeGeneratorService,
    private readonly audit: AuditLogService,
    private readonly stock: StockTransactionService,
    private readonly ctx: RequestContextService,
  ) {}

  async list(q: QueryMachineDto) {
    const conds: SQL[] = [];
    if (q.status) conds.push(eq(machines.status, q.status));
    if (q.serial) conds.push(like(machines.serial, `%${q.serial}%`));
    if (q.search) {
      const searchCond = or(
        like(machines.code, `%${q.search}%`),
        like(machines.serial, `%${q.search}%`),
      );
      if (searchCond) conds.push(searchCond);
    }
    const where = conds.length ? and(...conds) : undefined;
    const { take, skip } = buildPagination(q.page, q.pageSize);
    const db = this.dbs.db;
    const rows = await db
      .select()
      .from(machines)
      .where(where)
      .orderBy(desc(machines.createdAt))
      .limit(take)
      .offset(skip);
    const totalRows = await db
      .select({ count: sql<number>`count(*)`.as("count") })
      .from(machines)
      .where(where);
    const total = Number(totalRows[0]?.count ?? 0);
    // _count emulation: two grouped queries for the whole page.
    const ids = rows.map((m) => m.id);
    const mcCounts = ids.length
      ? await db
          .select({
            refId: machineComponents.machineId,
            count: sql<number>`count(*)`.as("count"),
          })
          .from(machineComponents)
          .where(inArray(machineComponents.machineId, ids))
          .groupBy(machineComponents.machineId)
      : [];
    const scCounts = ids.length
      ? await db
          .select({
            refId: components.sourceMachineId,
            count: sql<number>`count(*)`.as("count"),
          })
          .from(components)
          .where(inArray(components.sourceMachineId, ids))
          .groupBy(components.sourceMachineId)
      : [];
    const mcMap = new Map(mcCounts.map((c) => [c.refId, Number(c.count)]));
    const scMap = new Map(scCounts.map((c) => [c.refId, Number(c.count)]));
    // Alias `cost` → `purchasePrice` để UI (page list + detail) khớp field name.
    const projected = rows.map((m) => ({
      ...m,
      _count: {
        machineComponents: mcMap.get(m.id) ?? 0,
        sourcedComponents: scMap.get(m.id) ?? 0,
      },
      purchasePrice: Number(m.cost),
    }));
    return paginate(projected, total, q.page ?? 1, q.pageSize ?? 20);
  }

  async get(id: string) {
    const item = await this.dbs.db.query.machines.findFirst({
      where: eq(machines.id, id),
      with: {
        machineComponents: { with: { category: true, component: true } },
        sourcedComponents: { with: { category: true } },
        purchaseItem: { with: { purchaseOrder: true } },
      },
    });
    if (!item) throw new NotFoundException({ code: "MACHINE_NOT_FOUND", message: "Machine not found" });
    // Alias `cost` → `purchasePrice` để khớp UI (schema dùng `cost` từ Phase 0,
    // nhưng UI + docs gọi là "giá mua").
    return { ...item, purchasePrice: Number(item.cost) };
  }

  async update(id: string, dto: UpdateMachineDto) {
    const beforeRows = await this.dbs.db
      .select()
      .from(machines)
      .where(eq(machines.id, id))
      .limit(1);
    const before = beforeRows[0];
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
    await this.dbs.transaction(async (db) => {
      const data: Partial<typeof machines.$inferInsert> = {};
      if (dto.serial !== undefined) data.serial = dto.serial.trim() || null;
      if (dto.notes !== undefined) data.notes = dto.notes.trim() || null;
      if (dto.purchasePrice !== undefined) data.cost = dto.purchasePrice;
      const afterRows = await db
        .update(machines)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(machines.id, id))
        .returning();
      const after = afterRows[0];
      await this.audit.record(
        {
          action: "machine.update",
          entityType: "Machine",
          entityId: id,
          before,
          after,
        },
        db,
      );
    });
    // Fetch sau khi tx đã commit — get() dùng this.dbs nên trước commit sẽ
    // đọc snapshot cũ; phải gọi sau `await dbs.transaction(...)`.
    return this.get(id);
  }

  async inspect(id: string, dto: InspectMachineDto) {
    const before = await this.dbs.db.query.machines.findFirst({
      where: eq(machines.id, id),
      with: { machineComponents: true },
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
    return this.dbs.transaction(async (db) => {
      // Wipe MachineComponent cũ để re-inspect ghi đè kết quả. Cần đảm bảo
      // KHÔNG có linh kiện nào đã link ra Component thật (tức đã tháo máy)
      // — check trên bằng status guard đã đảm bảo trạng thái CHECKED không có
      // componentId gắn (chỉ DISASSEMBLED mới có).
      await db.delete(machineComponents).where(eq(machineComponents.machineId, id));

      for (const c of dto.components) {
        const categoryRows = await db
          .select()
          .from(componentCategories)
          .where(eq(componentCategories.code, c.categoryCode))
          .limit(1);
        const category = categoryRows[0];
        if (!category) {
          throw new BusinessError(
            "COMPONENT_CATEGORY_NOT_FOUND",
            `Category ${c.categoryCode} not found`,
          );
        }
        await db.insert(machineComponents).values({
          id: createId(),
          machineId: id,
          categoryId: category.id,
          model: c.model ?? null,
          serial: c.serial ?? null,
          condition: c.condition,
          notes: c.notes ?? null,
        });
      }

      const afterRows = await db
        .update(machines)
        .set({
          status: MachineStatus.CHECKED,
          inspectedAt: new Date(),
          notes: dto.notes ?? before.notes,
          updatedAt: new Date(),
        })
        .where(eq(machines.id, id))
        .returning();
      const after = afterRows[0];

      await this.audit.record(
        { action: "machine.inspect", entityType: "Machine", entityId: id, before, after },
        db,
      );
      const result = await db.query.machines.findFirst({
        where: eq(machines.id, id),
        with: { machineComponents: { with: { category: true } } },
      });
      if (!result) throw new NotFoundException({ code: "MACHINE_NOT_FOUND", message: "Machine not found" });
      return result;
    });
  }

  async allocateCost(id: string, dto: AllocateCostDto) {
    const machine = await this.dbs.db.query.machines.findFirst({
      where: eq(machines.id, id),
      with: { machineComponents: { with: { category: true } } },
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

    await this.dbs.transaction(async (db) => {
      // Reset trước: các category KHÔNG có trong items → cost = 0.
      const allocatedCategories = new Set(dto.items.map((i) => i.categoryCode));
      for (const mc of machine.machineComponents) {
        if (!allocatedCategories.has(mc.category.code)) {
          await db
            .update(machineComponents)
            .set({ allocatedCost: 0, updatedAt: new Date() })
            .where(eq(machineComponents.id, mc.id));
        }
      }
      for (const u of updates) {
        await db
          .update(machineComponents)
          .set({ allocatedCost: u.cost, updatedAt: new Date() })
          .where(eq(machineComponents.id, u.id));
      }
      await this.audit.record(
        {
          action: "machine.allocate_cost",
          entityType: "Machine",
          entityId: id,
          before: machine,
          after: { items: dto.items, totalAllocated, expected },
        },
        db,
      );
    });
    return this.get(id);
  }

  async disassemble(id: string) {
    const before = await this.dbs.db.query.machines.findFirst({
      where: eq(machines.id, id),
      with: { machineComponents: { with: { category: true } } },
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
    return this.dbs.transaction(async (db) => {
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
        const compCode = await this.codes.next(mc.category.prefix, db, 6);
        const newCompRows = await db
          .insert(components)
          .values({
            id: createId(),
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
          })
          .returning();
        const newComp = newCompRows[0];
        await db
          .update(machineComponents)
          .set({ componentId: newComp.id, updatedAt: new Date() })
          .where(eq(machineComponents.id, mc.id));
        await this.stock.create(
          {
            componentId: newComp.id,
            type: StockTxnType.IN,
            reason: "Machine disassembly",
            refType: "MACHINE",
            refId: before.id,
          },
          db,
        );
        created++;
      }
      const afterRows = await db
        .update(machines)
        .set({
          status: MachineStatus.DISASSEMBLED,
          disassembledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(machines.id, id))
        .returning();
      const after = afterRows[0];
      await this.audit.record(
        {
          action: "machine.disassemble",
          entityType: "Machine",
          entityId: id,
          before,
          after: { ...after, componentsCreated: created, slotsSkipped: skipped },
        },
        db,
      );
      const result = await db.query.machines.findFirst({
        where: eq(machines.id, id),
        with: { sourcedComponents: true },
      });
      if (!result) throw new NotFoundException({ code: "MACHINE_NOT_FOUND", message: "Machine not found" });
      return result;
    });
  }

  async markReadyForSale(id: string) {
    const beforeRows = await this.dbs.db
      .select()
      .from(machines)
      .where(eq(machines.id, id))
      .limit(1);
    const before = beforeRows[0];
    if (!before) throw new NotFoundException({ code: "MACHINE_NOT_FOUND", message: "Machine not found" });
    if (before.status !== MachineStatus.CHECKED) {
      throw new BusinessError(
        "INVALID_STATUS_TRANSITION",
        `Cannot mark ready for sale from status ${before.status}`,
        HttpStatus.CONFLICT,
      );
    }
    return this.dbs.transaction(async (db) => {
      const afterRows = await db
        .update(machines)
        .set({ status: MachineStatus.READY_FOR_SALE, updatedAt: new Date() })
        .where(eq(machines.id, id))
        .returning();
      const after = afterRows[0];
      await this.audit.record(
        { action: "machine.ready_for_sale", entityType: "Machine", entityId: id, before, after },
        db,
      );
      return after;
    });
  }
}
