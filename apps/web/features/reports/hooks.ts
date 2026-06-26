"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchDashboard, fetchProfitReport, type ProfitQuery } from "./api";

export const dashboardKeys = {
  all: ["dashboard"] as const,
};

export const reportsKeys = {
  profit: (q: ProfitQuery) => ["reports", "profit", q] as const,
};

export function useDashboard() {
  return useQuery({
    queryKey: dashboardKeys.all,
    queryFn: fetchDashboard,
  });
}

export function useProfitReport(query: ProfitQuery) {
  return useQuery({
    queryKey: reportsKeys.profit(query),
    queryFn: () => fetchProfitReport(query),
  });
}
