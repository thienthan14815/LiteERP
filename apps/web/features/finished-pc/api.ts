import { apiClient } from "@/lib/api-client";
import {
  ComponentCategoryCode,
  ComponentStatus,
  FinishedPcStatus,
} from "@app/shared";

export interface FinishedPcListItem {
  id: string;
  code: string;
  status: FinishedPcStatus;
  costPrice: number;
  suggestedPrice: number;
  soldPrice?: number | null;
  componentCount: number;
  notes?: string | null;
  readyAt?: string | null;
  soldAt?: string | null;
  createdAt: string;
  assemblyOrder?: { id: string; code: string } | null;
}

export interface FinishedPcComponentRef {
  id: string;
  code: string;
  categoryCode: ComponentCategoryCode;
  model?: string | null;
  serial?: string | null;
  status: ComponentStatus;
  costPrice: number;
}

export interface FinishedPcComponentHistoryItem {
  id: string;
  componentId: string;
  componentCode: string;
  categoryCode: ComponentCategoryCode;
  model?: string | null;
  serial?: string | null;
  installedAt: string;
  removedAt?: string | null;
  isCurrent: boolean;
}

/** Slot cấu hình từ bước Kiểm tra & định giá của máy gốc (máy bán nguyên). */
export interface MachineConfigSlot {
  categoryCode: ComponentCategoryCode;
  model?: string | null;
  serial?: string | null;
  condition?: string | null;
  notes?: string | null;
  quantity: number;
  cost: number;
}

export interface FinishedPcDetail extends FinishedPcListItem {
  assemblyOrder?: {
    id: string;
    code: string;
    status: string;
  } | null;
  currentComponents: FinishedPcComponentRef[];
  componentHistory: FinishedPcComponentHistoryItem[];
  /** Máy gốc khi đây là máy bán nguyên chiếc ("Để nguyên — bán máy"). */
  sourceMachine?: { id: string; code: string; serial?: string | null } | null;
  /** Cấu hình theo kết quả kiểm tra máy gốc (máy bán nguyên chưa tháo). */
  machineSlots?: MachineConfigSlot[];
  repairHistory: unknown[];
}

export interface FinishedPcListQuery {
  page?: number;
  pageSize?: number;
  status?: FinishedPcStatus | "ALL";
  search?: string;
}

export interface PaginatedFinishedPcs {
  items: FinishedPcListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function unwrap<T>(payload: any): T {
  return (payload?.data ?? payload) as T;
}

export async function listFinishedPcs(
  query: FinishedPcListQuery = {},
): Promise<PaginatedFinishedPcs> {
  const params: Record<string, unknown> = { ...query };
  if (params.status === "ALL") delete params.status;
  const { data } = await apiClient.get("/finished-pcs", { params });
  return unwrap<PaginatedFinishedPcs>(data);
}

export async function getFinishedPc(id: string): Promise<FinishedPcDetail> {
  const { data } = await apiClient.get(`/finished-pcs/${id}`);
  return unwrap<FinishedPcDetail>(data);
}

export interface UpdateFinishedPcDto {
  suggestedPrice?: number;
  notes?: string;
}

export async function updateFinishedPc(
  id: string,
  payload: UpdateFinishedPcDto,
): Promise<FinishedPcDetail> {
  const { data } = await apiClient.patch(`/finished-pcs/${id}`, payload);
  return unwrap<FinishedPcDetail>(data);
}

export async function transitionFinishedPc(
  id: string,
  to: FinishedPcStatus,
): Promise<FinishedPcDetail> {
  const { data } = await apiClient.post(`/finished-pcs/${id}/transition`, { to });
  return unwrap<FinishedPcDetail>(data);
}

export async function scrapFinishedPc(id: string): Promise<FinishedPcDetail> {
  const { data } = await apiClient.post(`/finished-pcs/${id}/scrap`);
  return unwrap<FinishedPcDetail>(data);
}

export async function searchReadyFinishedPcs(
  search: string,
): Promise<FinishedPcListItem[]> {
  const { data } = await apiClient.get("/finished-pcs", {
    params: {
      search,
      pageSize: 50,
      status: FinishedPcStatus.READY_FOR_SALE,
    },
  });
  const payload = unwrap<PaginatedFinishedPcs>(data);
  return payload.items ?? [];
}
