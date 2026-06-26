import { apiClient } from "@/lib/api-client";

export interface DashboardAttentionItem {
  count: number;
  label: string;
  link: string;
}

export interface DashboardKpis {
  revenue: number;
  profit: number;
  inventoryValue: number;
  machineCount: number;
  componentCount: number;
  machinesWaitingTest: number;
  warrantyOpen: number;
  attentionItems: DashboardAttentionItem[];
}

export interface DashboardRaw {
  revenueThisMonth: number;
  profitThisMonth: number;
  inventoryValue: number;
  machinesByStatus: Record<string, number>;
  componentsByStatus: Record<string, number>;
  machinesAwaitingInspection: number;
  openWarrantyCases: number;
  attentionItems: DashboardAttentionItem[];
}

export interface ProfitDaily {
  date: string;
  revenue: number;
  cost: number;
  profit: number;
}

export interface ProfitReport {
  revenue: number;
  cost: number;
  profit: number;
  salesCount: number;
  fromDate: string;
  toDate: string;
  dailyBreakdown: ProfitDaily[];
}

export interface InventoryValueCategory {
  category: string;
  name: string;
  value: number;
  count: number;
}

export interface InventoryValueReport {
  totalValue: number;
  totalCount: number;
  byCategory: InventoryValueCategory[];
  topCategories: InventoryValueCategory[];
}

export interface SalesByProductRow {
  itemType: "FINISHED_PC" | "COMPONENT";
  name: string;
  qty: number;
  revenue: number;
  cost: number;
  profit: number;
}

export interface TopCustomerRow {
  customerId: string;
  code: string;
  name: string;
  phone: string | null;
  revenue: number;
  cost: number;
  profit: number;
  orderCount: number;
}

export interface InventoryAgingReport {
  thresholdDays: number;
  totalAging: number;
  byCategory: Array<{ category: string; name: string; count: number; value: number }>;
}

function unwrap<T>(data: any): T {
  return (data?.data ?? data) as T;
}

export async function fetchDashboard(): Promise<DashboardKpis> {
  const { data } = await apiClient.get("/dashboard");
  const raw = unwrap<DashboardRaw>(data);
  const machineCount = Object.values(raw.machinesByStatus ?? {}).reduce((s, n) => s + n, 0);
  const componentCount = Object.values(raw.componentsByStatus ?? {}).reduce((s, n) => s + n, 0);
  return {
    revenue: raw.revenueThisMonth ?? 0,
    profit: raw.profitThisMonth ?? 0,
    inventoryValue: raw.inventoryValue ?? 0,
    machineCount,
    componentCount,
    machinesWaitingTest: raw.machinesAwaitingInspection ?? 0,
    warrantyOpen: raw.openWarrantyCases ?? 0,
    attentionItems: raw.attentionItems ?? [],
  };
}

export interface DateRangeQuery {
  fromDate?: string;
  toDate?: string;
}

export async function fetchProfitReport(q: DateRangeQuery = {}): Promise<ProfitReport> {
  const { data } = await apiClient.get("/reports/profit", { params: q });
  return unwrap<ProfitReport>(data);
}

export async function fetchInventoryValue(): Promise<InventoryValueReport> {
  const { data } = await apiClient.get("/reports/inventory-value");
  return unwrap<InventoryValueReport>(data);
}

export async function fetchSalesByProduct(q: DateRangeQuery): Promise<SalesByProductRow[]> {
  const { data } = await apiClient.get("/reports/sales-by-product", { params: q });
  return unwrap<SalesByProductRow[]>(data);
}

export async function fetchTopCustomers(q: DateRangeQuery & { limit?: number }): Promise<TopCustomerRow[]> {
  const { data } = await apiClient.get("/reports/top-customers", { params: q });
  return unwrap<TopCustomerRow[]>(data);
}

export async function fetchInventoryAging(days = 30): Promise<InventoryAgingReport> {
  const { data } = await apiClient.get("/reports/inventory-aging", { params: { days } });
  return unwrap<InventoryAgingReport>(data);
}
