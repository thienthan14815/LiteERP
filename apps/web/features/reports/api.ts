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

function unwrap<T>(data: any): T {
  return (data?.data ?? data) as T;
}

export async function fetchDashboard(): Promise<DashboardKpis> {
  const { data } = await apiClient.get("/dashboard");
  return unwrap<DashboardKpis>(data);
}
