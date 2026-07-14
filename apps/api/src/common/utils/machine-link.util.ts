// Máy cũ "để nguyên — bán máy" lên kệ dưới dạng một bản ghi FinishedPc để đi
// chung luồng bán hàng với PC lắp ráp. Hai bảng không có FK trực tiếp nên
// liên kết bằng marker trong finished_pcs.notes — cùng convention loose-link
// "Purchase item <id>" của components. Marker đặt CUỐI để phần đầu đọc tự nhiên.
const MARKER_RE = /\[MACHINE:([A-Za-z0-9]+)\]/;

/** Notes cho FinishedPc đại diện máy bán nguyên: "Bán nguyên máy PC000001 [MACHINE:<id>]". */
export function buildWholeMachineNotes(machineCode: string, machineId: string): string {
  return `Bán nguyên máy ${machineCode} [MACHINE:${machineId}]`;
}

/** Trích machine id từ notes của FinishedPc; null nếu không phải máy bán nguyên. */
export function machineIdFromFinishedPcNotes(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const m = MARKER_RE.exec(notes);
  return m ? m[1] : null;
}

/** Pattern LIKE để tìm FinishedPc đại diện của một máy. */
export function wholeMachineLikePattern(machineId: string): string {
  return `%[MACHINE:${machineId}]%`;
}

export type CollapsedMachineSlot = {
  categoryCode: string;
  model: string | null;
  serial: string | null;
  condition: string;
  notes: string | null;
  quantity: number;
  cost: number;
};

/**
 * Gộp các dòng machine_components giống hệt nhau thành slot có `quantity`
 * (inspect() lưu mỗi chiếc 1 dòng; serial ghi chung cho cả lô nằm trong khóa
 * gộp). Dùng chung cho machines.get() và finished-pcs.get() (máy bán nguyên).
 */
export function collapseMachineSlots(
  rows: Array<{
    categoryId: string;
    model: string | null;
    serial: string | null;
    condition: string;
    notes: string | null;
    allocatedCost: unknown;
    category: { code: string };
  }>,
): CollapsedMachineSlot[] {
  const slots: CollapsedMachineSlot[] = [];
  const groupIdx = new Map<string, number>();
  for (const mc of rows) {
    const cost = Number(mc.allocatedCost);
    const serial = mc.serial?.trim() ?? "";
    const key = ["g", mc.categoryId, mc.model ?? "", serial, mc.condition, mc.notes ?? "", cost].join("|");
    const at = groupIdx.get(key);
    if (at === undefined) {
      groupIdx.set(key, slots.length);
      slots.push({
        categoryCode: mc.category.code,
        model: mc.model,
        serial: mc.serial,
        condition: mc.condition,
        notes: mc.notes,
        quantity: 1,
        cost,
      });
    } else {
      slots[at].quantity += 1;
    }
  }
  return slots;
}
