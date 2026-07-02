import { apiClient } from "@/lib/api-client";

function unwrap<T>(p: any): T {
  if (p && Array.isArray(p.items) && typeof p.total === "number") {
    return p.items as unknown as T;
  }
  return (p?.data ?? p) as T;
}

/* ------------------- CUSTOMERS ------------------- */

export interface CustomerRow {
  id: string;
  code: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
}

export interface CustomerInput {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}

export async function listAllCustomers(): Promise<CustomerRow[]> {
  const { data } = await apiClient.get("/customers", { params: { pageSize: 500 } });
  return unwrap<CustomerRow[]>(data);
}
export async function createCustomerRow(payload: CustomerInput): Promise<CustomerRow> {
  const { data } = await apiClient.post("/customers", payload);
  return unwrap<CustomerRow>(data);
}
export async function updateCustomerRow(id: string, payload: CustomerInput): Promise<CustomerRow> {
  const { data } = await apiClient.patch(`/customers/${id}`, payload);
  return unwrap<CustomerRow>(data);
}
export async function deleteCustomerRow(id: string): Promise<void> {
  await apiClient.delete(`/customers/${id}`);
}

/* ------------------- SUPPLIERS ------------------- */

export type SupplierCategory = "WHOLESALE" | "RETAIL";

export interface SupplierRow {
  id: string;
  code: string;
  name: string;
  fbUrl?: string | null;
  marketplaceUrl?: string | null;
  category?: SupplierCategory | null;
  notes?: string | null;
}

export interface SupplierInput {
  name: string;
  fbUrl?: string;
  marketplaceUrl?: string;
  category?: SupplierCategory;
  notes?: string;
}

export async function listAllSuppliers(): Promise<SupplierRow[]> {
  const { data } = await apiClient.get("/suppliers", { params: { pageSize: 500 } });
  return unwrap<SupplierRow[]>(data);
}
export async function createSupplierRow(payload: SupplierInput): Promise<SupplierRow> {
  const { data } = await apiClient.post("/suppliers", payload);
  return unwrap<SupplierRow>(data);
}
export async function updateSupplierRow(id: string, payload: SupplierInput): Promise<SupplierRow> {
  const { data } = await apiClient.patch(`/suppliers/${id}`, payload);
  return unwrap<SupplierRow>(data);
}
export async function deleteSupplierRow(id: string): Promise<void> {
  await apiClient.delete(`/suppliers/${id}`);
}
