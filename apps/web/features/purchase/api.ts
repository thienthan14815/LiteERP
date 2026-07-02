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
  itemType: PurchaseItemType;
  description: string;
  categoryCode?: ComponentCategoryCode | null;
  model?: string | null;
  serial?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string | null;
  machines?: Array<{ id: string; code: string; serial?: string | null }>;
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
  model?: string;
  serial?: string;
  quantity: number;
  unitPrice: number;
  categoryCode?: ComponentCategoryCode;
  notes?: string;
}

export interface UpdatePurchaseItemInput {
  itemType?: PurchaseItemType;
  description?: string;
  model?: string;
  serial?: string;
  quantity?: number;
  unitPrice?: number;
  categoryCode?: ComponentCategoryCode;
  notes?: string;
}

export interface CreatePurchaseDto {
  supplierId?: string;
  otherCost?: number;
  notes?: string;
  items: CreatePurchaseItemInput[];
}

export type SupplierCategory = "WHOLESALE" | "RETAIL";

export interface CreateSupplierInput {
  name: string;
  fbUrl?: string;
  marketplaceUrl?: string;
  category?: SupplierCategory;
  notes?: string;
}

export async function createSupplier(
  payload: CreateSupplierInput,
): Promise<SupplierOption> {
  const { data } = await apiClient.post("/suppliers", payload);
  return unwrap<SupplierOption>(data);
}

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

export async function updatePurchaseItem(
  orderId: string,
  itemId: string,
  payload: UpdatePurchaseItemInput,
): Promise<PurchaseItem> {
  const { data } = await apiClient.patch(
    `/purchases/${orderId}/items/${itemId}`,
    payload,
  );
  return unwrap<PurchaseItem>(data);
}

export async function deletePurchaseItem(
  orderId: string,
  itemId: string,
): Promise<void> {
  await apiClient.delete(`/purchases/${orderId}/items/${itemId}`);
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
