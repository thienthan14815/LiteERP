import { apiClient } from "@/lib/api-client";
import {
  ComponentCategoryCode,
  ComponentStatus,
  FinishedPcStatus,
  SalesItemType,
  SalesOrderStatus,
} from "@app/shared";

export interface CustomerOption {
  id: string;
  code: string;
  name: string;
  phone?: string | null;
  email?: string | null;
}

export interface SaleListItem {
  id: string;
  code: string;
  status: SalesOrderStatus;
  customer?: { id: string; name: string; phone?: string | null } | null;
  totalAmount: number;
  revenue: number;
  cost: number;
  profit: number;
  itemCount: number;
  notes?: string | null;
  confirmedAt?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
}

export interface SaleItem {
  id: string;
  itemType: SalesItemType;
  finishedPcId?: string | null;
  componentId?: string | null;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  totalPrice: number;
  finishedPc?: { id: string; code: string; status: FinishedPcStatus } | null;
  component?: {
    id: string;
    code: string;
    model?: string | null;
    serialNumber?: string | null;
    category: { code: ComponentCategoryCode };
  } | null;
}

export interface SaleDetail extends SaleListItem {
  customer?: CustomerOption | null;
  items: SaleItem[];
}

export interface SaleListQuery {
  page?: number;
  pageSize?: number;
  status?: SalesOrderStatus | "ALL";
  customerId?: string;
  search?: string;
  fromDate?: string;
  toDate?: string;
}

export interface PaginatedSales {
  items: SaleListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateSaleItemInput {
  itemType: SalesItemType;
  finishedPcId?: string;
  componentId?: string;
  unitPrice: number;
  qty?: number;
}

export interface CreateSaleDto {
  customerId: string;
  notes?: string;
  items: CreateSaleItemInput[];
}

export interface UpdateSaleDto {
  customerId?: string;
  notes?: string;
  items?: CreateSaleItemInput[];
}

function unwrap<T>(payload: any): T {
  return (payload?.data ?? payload) as T;
}

export async function listSales(query: SaleListQuery = {}): Promise<PaginatedSales> {
  const params: Record<string, unknown> = { ...query };
  if (params.status === "ALL") delete params.status;
  const { data } = await apiClient.get("/sales", { params });
  return unwrap<PaginatedSales>(data);
}

export async function getSale(id: string): Promise<SaleDetail> {
  const { data } = await apiClient.get(`/sales/${id}`);
  return unwrap<SaleDetail>(data);
}

export async function createSale(payload: CreateSaleDto): Promise<SaleDetail> {
  const { data } = await apiClient.post("/sales", payload);
  return unwrap<SaleDetail>(data);
}

export async function updateSale(id: string, payload: UpdateSaleDto): Promise<SaleDetail> {
  const { data } = await apiClient.patch(`/sales/${id}`, payload);
  return unwrap<SaleDetail>(data);
}

export async function confirmSale(id: string): Promise<SaleDetail> {
  const { data } = await apiClient.post(`/sales/${id}/confirm`);
  return unwrap<SaleDetail>(data);
}

export async function cancelSale(id: string): Promise<SaleDetail> {
  const { data } = await apiClient.post(`/sales/${id}/cancel`);
  return unwrap<SaleDetail>(data);
}

interface PaginatedCustomers {
  items: CustomerOption[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function searchCustomers(q: string): Promise<CustomerOption[]> {
  const { data } = await apiClient.get("/customers", {
    params: { search: q, pageSize: 20 },
  });
  const payload = unwrap<PaginatedCustomers>(data);
  return payload.items ?? [];
}

export interface CreateCustomerInput {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
}

export async function createCustomer(payload: CreateCustomerInput): Promise<CustomerOption> {
  const { data } = await apiClient.post("/customers", payload);
  return unwrap<CustomerOption>(data);
}

export interface SellableComponent {
  id: string;
  code: string;
  categoryCode: ComponentCategoryCode;
  model?: string | null;
  serial?: string | null;
  costPrice: number;
  status: ComponentStatus;
}

interface PaginatedComponents {
  items: SellableComponent[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function searchSellableComponents(q: string): Promise<SellableComponent[]> {
  const { data } = await apiClient.get("/components", {
    params: {
      search: q,
      pageSize: 50,
      status: ComponentStatus.IN_STOCK,
    },
  });
  const payload = unwrap<PaginatedComponents>(data);
  return payload.items ?? [];
}
