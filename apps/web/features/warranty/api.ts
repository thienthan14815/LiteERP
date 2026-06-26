import { apiClient } from "@/lib/api-client";
import { ComponentStatus, FinishedPcStatus, WarrantyStatus } from "@app/shared";

export interface WarrantyListItem {
  id: string;
  code: string;
  status: WarrantyStatus;
  description: string;
  receivedAt: string;
  completedAt?: string | null;
  customer?: { id: string; name: string; phone?: string | null } | null;
  finishedPc?: { id: string; code: string; status: FinishedPcStatus } | null;
  _count?: { items: number };
  createdAt: string;
}

export interface WarrantyTimelineEntry {
  id: string;
  action: string;
  createdAt: string;
  actorUserId: string | null;
  beforeJson: unknown;
  afterJson: unknown;
}

export interface WarrantyItemRow {
  id: string;
  notes?: string | null;
  createdAt: string;
  removedComponent?: {
    id: string;
    code: string;
    serialNumber?: string | null;
    model?: string | null;
    category: { code: string };
  } | null;
  replacementComponent?: {
    id: string;
    code: string;
    serialNumber?: string | null;
    model?: string | null;
    category: { code: string };
  } | null;
}

export interface WarrantyDetail extends WarrantyListItem {
  customer?: {
    id: string;
    code: string;
    name: string;
    phone?: string | null;
    email?: string | null;
  } | null;
  items: WarrantyItemRow[];
  meta: {
    originalStatus?: {
      finishedPc?: FinishedPcStatus;
      component?: ComponentStatus;
    };
    componentId?: string;
    salesOrderId?: string;
    freeform?: string;
  };
  relatedComponent: {
    id: string;
    code: string;
    serialNumber: string | null;
    status: ComponentStatus;
  } | null;
  timeline: WarrantyTimelineEntry[];
}

export interface WarrantyListQuery {
  page?: number;
  pageSize?: number;
  status?: WarrantyStatus | "ALL";
  customerId?: string;
  search?: string;
  fromDate?: string;
  toDate?: string;
}

export interface PaginatedWarranties {
  items: WarrantyListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateWarrantyDto {
  customerId: string;
  finishedPcId?: string;
  componentId?: string;
  salesOrderId?: string;
  issue: string;
  receivedAt?: string;
  notes?: string;
}

export interface ReplaceComponentDto {
  removedComponentId: string;
  replacementComponentId: string;
  notes?: string;
}

function unwrap<T>(p: any): T {
  return (p?.data ?? p) as T;
}

export async function listWarranties(q: WarrantyListQuery = {}): Promise<PaginatedWarranties> {
  const params: Record<string, unknown> = { ...q };
  if (params.status === "ALL") delete params.status;
  const { data } = await apiClient.get("/warranties", { params });
  return unwrap<PaginatedWarranties>(data);
}

export async function getWarranty(id: string): Promise<WarrantyDetail> {
  const { data } = await apiClient.get(`/warranties/${id}`);
  return unwrap<WarrantyDetail>(data);
}

export async function createWarranty(payload: CreateWarrantyDto): Promise<WarrantyListItem> {
  const { data } = await apiClient.post("/warranties", payload);
  return unwrap<WarrantyListItem>(data);
}

export async function transitionWarranty(
  id: string,
  to: WarrantyStatus,
  notes?: string,
): Promise<WarrantyListItem> {
  const { data } = await apiClient.patch(`/warranties/${id}/status`, { to, notes });
  return unwrap<WarrantyListItem>(data);
}

export async function cancelWarranty(id: string): Promise<WarrantyListItem> {
  const { data } = await apiClient.post(`/warranties/${id}/cancel`);
  return unwrap<WarrantyListItem>(data);
}

export async function replaceWarrantyComponent(
  id: string,
  payload: ReplaceComponentDto,
): Promise<WarrantyItemRow> {
  const { data } = await apiClient.post(`/warranties/${id}/replace-component`, payload);
  return unwrap<WarrantyItemRow>(data);
}

export interface SoldFinishedPcOption {
  id: string;
  code: string;
  status: FinishedPcStatus;
  costPrice: number;
  suggestedPrice: number;
  componentCount: number;
}

export async function searchWarrantableFinishedPcs(
  search: string,
): Promise<SoldFinishedPcOption[]> {
  const { data } = await apiClient.get("/finished-pcs", {
    params: { search, pageSize: 50, status: FinishedPcStatus.SOLD },
  });
  const payload = unwrap<{ items: SoldFinishedPcOption[] }>(data);
  return payload.items ?? [];
}

export interface SoldComponentOption {
  id: string;
  code: string;
  serialNumber?: string | null;
  model?: string | null;
  status: ComponentStatus;
  category: { code: string };
}

export async function searchWarrantableComponents(
  search: string,
): Promise<SoldComponentOption[]> {
  const { data } = await apiClient.get("/components", {
    params: { search, pageSize: 50, status: ComponentStatus.SOLD },
  });
  const payload = unwrap<{ items: SoldComponentOption[] }>(data);
  return payload.items ?? [];
}

export async function searchInStockComponents(
  search: string,
): Promise<SoldComponentOption[]> {
  const { data } = await apiClient.get("/components", {
    params: { search, pageSize: 50, status: ComponentStatus.IN_STOCK },
  });
  const payload = unwrap<{ items: SoldComponentOption[] }>(data);
  return payload.items ?? [];
}
