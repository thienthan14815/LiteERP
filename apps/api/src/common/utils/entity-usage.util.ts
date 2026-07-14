// VN: Kiểm tra một Component đang được "dùng" ở đâu trước khi cho xóa/hoàn tác.
// Schema SQLite này KHÔNG có FK constraint thật (mọi liên kết là text column),
// nên xóa mà không kiểm tra sẽ để lại rows mồ côi trong các bảng nghiệp vụ.
import { inArray, or } from "drizzle-orm";
import type { DrizzleDb } from "../../database/db.service";
import {
  assemblyItems,
  finishedPcComponents,
  machineComponents,
  salesItems,
  warrantyItems,
} from "../../database/schema";

/**
 * Trả về map componentId → danh sách nơi đang tham chiếu nó
 * (machine_components / assembly_items / finished_pc_components /
 * sales_items / warranty_items). Component có mặt trong map = KHÔNG xóa được.
 */
export async function findComponentUsage(
  db: DrizzleDb,
  componentIds: string[],
): Promise<Map<string, string[]>> {
  const usage = new Map<string, string[]>();
  if (componentIds.length === 0) return usage;
  const add = (id: string | null, place: string) => {
    if (!id) return;
    const list = usage.get(id) ?? [];
    list.push(place);
    usage.set(id, list);
  };

  for (const r of await db
    .select({ id: machineComponents.componentId })
    .from(machineComponents)
    .where(inArray(machineComponents.componentId, componentIds))) {
    add(r.id, "máy cũ (tháo máy)");
  }
  for (const r of await db
    .select({ id: assemblyItems.componentId })
    .from(assemblyItems)
    .where(inArray(assemblyItems.componentId, componentIds))) {
    add(r.id, "đơn lắp ráp");
  }
  for (const r of await db
    .select({ id: finishedPcComponents.componentId })
    .from(finishedPcComponents)
    .where(inArray(finishedPcComponents.componentId, componentIds))) {
    add(r.id, "máy thành phẩm");
  }
  for (const r of await db
    .select({ id: salesItems.componentId })
    .from(salesItems)
    .where(inArray(salesItems.componentId, componentIds))) {
    add(r.id, "đơn bán hàng");
  }
  for (const r of await db
    .select({
      removed: warrantyItems.removedComponentId,
      replacement: warrantyItems.replacementComponentId,
    })
    .from(warrantyItems)
    .where(
      or(
        inArray(warrantyItems.removedComponentId, componentIds),
        inArray(warrantyItems.replacementComponentId, componentIds),
      ),
    )) {
    add(r.removed && componentIds.includes(r.removed) ? r.removed : null, "đơn bảo hành");
    add(
      r.replacement && componentIds.includes(r.replacement) ? r.replacement : null,
      "đơn bảo hành",
    );
  }
  return usage;
}
