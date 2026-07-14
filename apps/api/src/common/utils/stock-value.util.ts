import { and, inArray, isNull, notInArray } from "drizzle-orm";
import { ComponentStatus, FinishedPcStatus, MachineStatus } from "@app/shared";
import type { DrizzleDb } from "../../database/db.service";
import { components, finishedPcs, machines } from "../../database/schema";

// "Giá trị tồn kho" = toàn bộ tiền vốn đang nằm trong hàng CHƯA BÁN, tính
// đúng một lần cho mỗi món:
//  - Linh kiện còn giữ trong kho: loại trừ đã bán / hủy / mất, loại trừ đang
//    nằm trong PC thành phẩm (giá trị đó tính qua PC), loại trừ đang đi theo
//    máy bảo hành của khách.
//  - Máy cũ chưa xử lý (NEW / CHECKED): giá mua + phí sửa + phí vệ sinh.
//    Máy READY_FOR_SALE tính qua bản ghi PC thành phẩm "bán nguyên máy";
//    máy DISASSEMBLED tính qua linh kiện đã tháo.
//  - PC thành phẩm chưa bán: loại trừ SOLD / SCRAPPED / WARRANTY (đã bán,
//    đang bảo hành cho khách).
export interface StockValueBucket {
  value: number;
  count: number;
}

export interface StockValue {
  totalValue: number;
  totalCount: number;
  components: StockValueBucket;
  machines: StockValueBucket;
  finishedPcs: StockValueBucket;
  byCategory: Array<{ category: string; name: string; value: number; count: number }>;
}

export async function computeStockValue(db: DrizzleDb): Promise<StockValue> {
  const compRows = await db.query.components.findMany({
    where: and(
      notInArray(components.status, [
        ComponentStatus.SOLD,
        ComponentStatus.SCRAPPED,
        ComponentStatus.LOST,
        ComponentStatus.ASSEMBLED,
        ComponentStatus.WARRANTY,
      ]),
      isNull(components.currentFinishedPcId),
    ),
    columns: { costPrice: true },
    with: { category: { columns: { code: true, name: true } } },
  });
  const machineRows = await db
    .select({
      cost: machines.cost,
      repairCost: machines.repairCost,
      cleaningCost: machines.cleaningCost,
    })
    .from(machines)
    .where(inArray(machines.status, [MachineStatus.NEW, MachineStatus.CHECKED]));
  const fpRows = await db
    .select({ costPrice: finishedPcs.costPrice })
    .from(finishedPcs)
    .where(
      notInArray(finishedPcs.status, [
        FinishedPcStatus.SOLD,
        FinishedPcStatus.SCRAPPED,
        FinishedPcStatus.WARRANTY,
      ]),
    );

  const byCategory = new Map<
    string,
    { category: string; name: string; value: number; count: number }
  >();
  let componentsValue = 0;
  for (const r of compRows) {
    const v = Number(r.costPrice);
    componentsValue += v;
    const cur = byCategory.get(r.category.code) ?? {
      category: r.category.code,
      name: r.category.name,
      value: 0,
      count: 0,
    };
    cur.value += v;
    cur.count += 1;
    byCategory.set(r.category.code, cur);
  }
  const machinesValue = machineRows.reduce(
    (s, m) => s + Number(m.cost) + Number(m.repairCost) + Number(m.cleaningCost),
    0,
  );
  const finishedPcsValue = fpRows.reduce((s, p) => s + Number(p.costPrice), 0);

  return {
    totalValue: componentsValue + machinesValue + finishedPcsValue,
    totalCount: compRows.length + machineRows.length + fpRows.length,
    components: { value: componentsValue, count: compRows.length },
    machines: { value: machinesValue, count: machineRows.length },
    finishedPcs: { value: finishedPcsValue, count: fpRows.length },
    byCategory: Array.from(byCategory.values()).sort((a, b) => b.value - a.value),
  };
}
