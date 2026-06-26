import { apiClient } from "@/lib/api-client";

export interface DashboardKpis {
  revenue: number;
  profit: number;
  inventoryValue: number;
  machineCount: number;
  componentCount: number;
  machinesWaitingTest: number;
  warrantyOpen: number;
}

export interface DashboardRaw {
  revenueThisMonth: number;
  profitThisMonth: number;
  inventoryValue: number;
  machinesByStatus: Record<string, number>;
  componentsByStatus: Record<string, number>;
  machinesAwaitingInspection: number;
  openWarrantyCases: number;
}

export interface ProfitReport {
  revenue: number;
  cost: number;
  profit: number;
  salesCount: number;
  fromDate: string;
  toDate: string;
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
  };
}

export interface ProfitQuery {
  fromDate?: string;
  toDate?: string;
}

export async function fetchProfitReport(q: ProfitQuery = {}): Promise<ProfitReport> {
  const { data } = await apiClient.get("/reports/profit", { params: q });
  return unwrap<ProfitReport>(data);
}
