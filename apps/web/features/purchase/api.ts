import { apiClient } from "@/lib/api-client";
import type { PaginatedResponse } from "@app/shared";
import {
  PurchaseOrderStatus,
  PurchaseItemType,
  ComponentCategoryCode,
} from "@app/shared";

export interface PurchaseListItem {
  id: string;
  code: string;
  supplier?: { id: string; name: string } | null;
  supplierName?: string;
  totalAmount: number;
  status: PurchaseOrderStatus;
  createdAt: string;
  itemCount?: number;
}

export interface PurchaseItem {
  id: string;
  type: PurchaseItemType;
  categoryCode?: ComponentCategoryCode | null;
  model?: string | null;
  serial?: string | null;
  purchasePrice: number;
  quantity?: number;
  notes?: string | null;
  machineId?: string | null;
  componentId?: string | null;
}

export interface PurchaseDetail extends PurchaseListItem {
  notes?: string | null;
  items: PurchaseItem[];
  confirmedAt?: string | null;
  cancelledAt?: string | null;
  createdBy?: { id: string; fullName: string } | null;
}

export interface PurchaseListQuery {
  page?: number;
  pageSize?: number;
  status?: PurchaseOrderStatus | "ALL";
  search?: string;
  supplierId?: string;
  from?: string;
  to?: string;
}

export interface CreatePurchaseDto {
  supplierId?: string;
  supplierName?: string;
  notes?: string;
  items: Array<{
    type: PurchaseItemType;
    categoryCode?: ComponentCategoryCode;
    model?: string;
    serial?: string;
    purchasePrice: number;
    quantity?: number;
    notes?: string;
  }>;
}

function unwrap<T>(payload: any): T {
  return (payload?.data ?? payload) as T;
}

export async function listPurchases(
  query: PurchaseListQuery = {},
): Promise<PaginatedResponse<PurchaseListItem>> {
  const params = { ...query };
  if (params.status === "ALL") delete params.status;
  const { data } = await apiClient.get("/purchases", { params });
  return unwrap<PaginatedResponse<PurchaseListItem>>(data);
}

export async function getPurchase(id: string): Promise<PurchaseDetail> {
  const { data } = await apiClient.get(`/purchases/${id}`);
  return unwrap<PurchaseDetail>(data);
}

export async function createPurchase(
  payload: CreatePurchaseDto,
): Promise<PurchaseDetail> {
  const { data } = await apiClient.post("/purchases", payload);
  return unwrap<PurchaseDetail>(data);
}

export async function confirmPurchase(id: string): Promise<PurchaseDetail> {
  const { data } = await apiClient.post(`/purchases/${id}/confirm`);
  return unwrap<PurchaseDetail>(data);
}

export async function cancelPurchase(id: string): Promise<PurchaseDetail> {
  const { data } = await apiClient.post(`/purchases/${id}/cancel`);
  return unwrap<PurchaseDetail>(data);
}

export interface SupplierOption {
  id: string;
  name: string;
}

export async function searchSuppliers(q: string): Promise<SupplierOption[]> {
  const { data } = await apiClient.get("/suppliers", {
    params: { search: q, pageSize: 20 },
  });
  const payload = unwrap<PaginatedResponse<SupplierOption> | SupplierOption[]>(
    data,
  );
  return Array.isArray(payload) ? payload : payload.data;
}
