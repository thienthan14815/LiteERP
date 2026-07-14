import { apiClient } from "@/lib/api-client";
import type { PaginatedResponse } from "@app/shared";
import {
  MachineStatus,
  ComponentStatus,
  ComponentCategoryCode,
  ComponentCondition,
  StockTxnType,
} from "@app/shared";

function unwrap<T>(payload: any): T {
  if (payload && Array.isArray(payload.items) && typeof payload.total === "number") {
    return {
      data: payload.items,
      meta: {
        page: payload.page,
        pageSize: payload.pageSize,
        total: payload.total,
        totalPages: payload.totalPages,
      },
    } as unknown as T;
  }
  return (payload?.data ?? payload) as T;
}

/* ---------------- MACHINES ---------------- */

export interface MachineListItem {
  id: string;
  code: string;
  serial?: string | null;
  model?: string | null;
  /** Miêu tả từ purchase item gốc (BE list() project sẵn). */
  description?: string | null;
  /** Ảnh đầu tiên đính kèm máy (Drive thumbnail) — cột Hình ảnh. */
  thumbnailUrl?: string | null;
  status: MachineStatus;
  purchasePrice: number;
  totalCost?: number;
  createdAt: string;
}

export interface MachineSlot {
  categoryCode: ComponentCategoryCode;
  model?: string | null;
  serial?: string | null;
  condition?: ComponentCondition | null;
  notes?: string | null;
  /** Số lượng linh kiện giống hệt nhau trên dòng này (mặc định 1). */
  quantity?: number;
  /** Giá vốn ban đầu cho MỖI linh kiện (đơn giá), nhập ở bước kiểm tra. */
  cost?: number;
}

export interface MachineDetail extends MachineListItem {
  components?: Array<{
    id: string;
    categoryCode: ComponentCategoryCode;
    code: string;
    serial?: string | null;
    model?: string | null;
    status: ComponentStatus;
    costPrice?: number;
  }>;
  inspection?: {
    inspectedAt?: string;
    slots: MachineSlot[];
  } | null;
  notes?: string | null;
}

export interface MachineListQuery {
  page?: number;
  pageSize?: number;
  status?: MachineStatus | "ALL";
  search?: string;
}

export async function listMachines(
  query: MachineListQuery = {},
): Promise<PaginatedResponse<MachineListItem>> {
  const params = { ...query };
  if (params.status === "ALL") delete params.status;
  const { data } = await apiClient.get("/machines", { params });
  return unwrap<PaginatedResponse<MachineListItem>>(data);
}

export async function getMachine(id: string): Promise<MachineDetail> {
  const { data } = await apiClient.get(`/machines/${id}`);
  return unwrap<MachineDetail>(data);
}

export interface InspectMachineDto {
  slots: MachineSlot[];
  notes?: string;
}

export async function inspectMachine(
  id: string,
  payload: InspectMachineDto,
): Promise<MachineDetail> {
  // Backend DTO key is `components` (not `slots`) và `condition` là bắt buộc,
  // nên phải map lại ở boundary để tránh Validation failed.
  const body = {
    components: payload.slots
      .filter((s) => !!s.categoryCode)
      .map((s) => ({
        categoryCode: s.categoryCode,
        model: s.model?.trim() ? s.model.trim() : undefined,
        serial: s.serial?.trim() ? s.serial.trim() : undefined,
        condition: s.condition ?? ComponentCondition.GOOD,
        quantity:
          s.quantity && Number(s.quantity) > 0
            ? Math.floor(Number(s.quantity))
            : 1,
        cost: Number(s.cost) > 0 ? Number(s.cost) : 0,
        notes: s.notes?.trim() ? s.notes.trim() : undefined,
      })),
    notes: payload.notes?.trim() ? payload.notes.trim() : undefined,
  };
  const { data } = await apiClient.post(`/machines/${id}/inspect`, body);
  return unwrap<MachineDetail>(data);
}

export async function disassembleMachine(id: string): Promise<MachineDetail> {
  const { data } = await apiClient.post(`/machines/${id}/disassemble`);
  return unwrap<MachineDetail>(data);
}

export async function markMachineReadyForSale(
  id: string,
): Promise<MachineDetail & { finishedPc?: { id: string; code: string } }> {
  const { data } = await apiClient.post(
    `/machines/${id}/mark-ready-for-sale`,
  );
  // BE tạo kèm bản ghi PC thành phẩm (lên kệ) và trả `finishedPc.code`.
  return unwrap<MachineDetail & { finishedPc?: { id: string; code: string } }>(
    data,
  );
}

export interface UpdateMachineDto {
  serial?: string;
  notes?: string;
  purchasePrice?: number;
}

export async function updateMachine(
  id: string,
  payload: UpdateMachineDto,
): Promise<MachineDetail> {
  const { data } = await apiClient.patch(`/machines/${id}`, payload);
  return unwrap<MachineDetail>(data);
}

export async function deleteMachine(id: string): Promise<void> {
  await apiClient.delete(`/machines/${id}`);
}

/* ---------------- COMPONENTS ---------------- */

export interface ComponentListItem {
  id: string;
  code: string;
  serial?: string | null;
  model?: string | null;
  categoryCode: ComponentCategoryCode;
  status: ComponentStatus;
  condition?: ComponentCondition | null;
  costPrice?: number;
  location?: string | null;
  sourceMachineId?: string | null;
  currentFinishedPcId?: string | null;
  createdAt: string;
  thumbnailUrl?: string | null;
}

export interface ComponentDetail extends ComponentListItem {
  sourceMachine?: { id: string; code: string } | null;
  currentFinishedPc?: { id: string; code: string } | null;
  history?: Array<{
    finishedPcId: string;
    finishedPcCode: string;
    finishedPcStatus?: string;
    installedAt: string;
    removedAt?: string | null;
  }>;
  stockTransactions?: StockTransaction[];
}

export interface ComponentListQuery {
  page?: number;
  pageSize?: number;
  // Legacy alias — vẫn nhận `category` từ callsite cũ; sẽ được đổi sang
  // `categoryCode` khi gửi để khớp backend DTO (QueryComponentDto).
  category?: ComponentCategoryCode | "ALL";
  categoryCode?: ComponentCategoryCode | "ALL";
  status?: ComponentStatus | "ALL";
  condition?: ComponentCondition | "ALL";
  search?: string;
}

export async function listComponents(
  query: ComponentListQuery = {},
): Promise<PaginatedResponse<ComponentListItem>> {
  const params: Record<string, unknown> = { ...query };
  // Map alias `category` → `categoryCode` (backend chỉ nhận `categoryCode`).
  if (params.category !== undefined) {
    if (params.categoryCode === undefined) params.categoryCode = params.category;
    delete params.category;
  }
  for (const k of ["categoryCode", "status", "condition"]) {
    if (params[k] === "ALL") delete params[k];
  }
  const { data } = await apiClient.get("/components", { params });
  return unwrap<PaginatedResponse<ComponentListItem>>(data);
}

export async function getComponent(id: string): Promise<ComponentDetail> {
  const { data } = await apiClient.get(`/components/${id}`);
  return unwrap<ComponentDetail>(data);
}

export async function scrapComponent(id: string): Promise<ComponentDetail> {
  const { data } = await apiClient.post(`/components/${id}/scrap`);
  return unwrap<ComponentDetail>(data);
}

export interface UpdateComponentDto {
  condition?: ComponentCondition;
  location?: string;
  model?: string;
  serialNumber?: string;
  notes?: string;
  costPrice?: number;
}

export async function updateComponent(
  id: string,
  payload: UpdateComponentDto,
): Promise<ComponentDetail> {
  const { data } = await apiClient.patch(`/components/${id}`, payload);
  return unwrap<ComponentDetail>(data);
}

export async function deleteComponent(id: string): Promise<void> {
  await apiClient.delete(`/components/${id}`);
}

/* ---------------- STOCK TRANSACTIONS ---------------- */

export interface StockTransaction {
  id: string;
  componentId: string;
  componentCode?: string;
  type: StockTxnType;
  reason?: string | null;
  reference?: string | null;
  createdAt: string;
  createdBy?: { id: string; fullName: string } | null;
}

export interface StockTxnListQuery {
  page?: number;
  pageSize?: number;
  type?: StockTxnType | "ALL";
  componentId?: string;
  fromDate?: string;
  toDate?: string;
}

export async function listStockTransactions(
  query: StockTxnListQuery = {},
): Promise<PaginatedResponse<StockTransaction>> {
  const params: Record<string, unknown> = { ...query };
  if (params.type === "ALL") delete params.type;
  const { data } = await apiClient.get("/inventory/stock-transactions", { params });
  return unwrap<PaginatedResponse<StockTransaction>>(data);
}

export interface InventorySummary {
  byStatus: Array<{ status: ComponentStatus; count: number }>;
  byCategory: Array<{ category: ComponentCategoryCode; count: number }>;
  /** Số máy cũ nhập kho theo trạng thái (VD: { NEW: 1, READY_FOR_SALE: 2 }). */
  machines?: Record<string, number>;
  /** Số PC thành phẩm theo trạng thái. */
  finishedPcs?: Record<string, number>;
}

export async function getInventorySummary(): Promise<InventorySummary> {
  const { data } = await apiClient.get("/inventory/summary");
  return unwrap<InventorySummary>(data);
}

export interface InventoryValue {
  /** Tổng vốn chưa bán: linh kiện + máy cũ + PC thành phẩm. */
  totalValue: number;
  totalCount: number;
  byCategory: Array<{
    category: ComponentCategoryCode;
    name: string;
    value: number;
    count: number;
  }>;
  breakdown?: {
    components: { value: number; count: number };
    machines: { value: number; count: number };
    finishedPcs: { value: number; count: number };
  };
}

export async function getInventoryValue(): Promise<InventoryValue> {
  const { data } = await apiClient.get("/inventory/value");
  return unwrap<InventoryValue>(data);
}
