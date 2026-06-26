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
  fromDate?: string;
  toDate?: string;
}

export interface CreatePurchaseItemInput {
  itemType: PurchaseItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  categoryCode?: ComponentCategoryCode;
  notes?: string;
}

export interface CreatePurchaseDto {
  supplierId?: string;
  otherCost?: number;
  notes?: string;
  items: CreatePurchaseItemInput[];
}

export interface CreateSupplierInput {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  taxCode?: string;
  notes?: string;
}

export async function createSupplier(
  payload: CreateSupplierInput,
): Promise<SupplierOption> {
  const { data } = await apiClient.post("/suppliers", payload);
  return unwrap<SupplierOption>(data);
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
