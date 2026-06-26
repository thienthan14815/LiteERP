"use client";

import { useQuery } from "@tanstack/react-query";
import {
  DateRangeQuery,
  fetchDashboard,
  fetchInventoryAging,
  fetchInventoryValue,
  fetchProfitReport,
  fetchSalesByProduct,
  fetchTopCustomers,
} from "./api";

export const dashboardKeys = { all: ["dashboard"] as const };

export const reportsKeys = {
  profit: (q: DateRangeQuery) => ["reports", "profit", q] as const,
  inventoryValue: () => ["reports", "inventory-value"] as const,
  salesByProduct: (q: DateRangeQuery) => ["reports", "sales-by-product", q] as const,
  topCustomers: (q: DateRangeQuery & { limit?: number }) =>
    ["reports", "top-customers", q] as const,
  inventoryAging: (days: number) => ["reports", "inventory-aging", days] as const,
};

export function useDashboard() {
  return useQuery({ queryKey: dashboardKeys.all, queryFn: fetchDashboard });
}

export function useProfitReport(query: DateRangeQuery) {
  return useQuery({
    queryKey: reportsKeys.profit(query),
    queryFn: () => fetchProfitReport(query),
  });
}

export function useInventoryValue() {
  return useQuery({
    queryKey: reportsKeys.inventoryValue(),
    queryFn: () => fetchInventoryValue(),
  });
}

export function useSalesByProduct(query: DateRangeQuery) {
  return useQuery({
    queryKey: reportsKeys.salesByProduct(query),
    queryFn: () => fetchSalesByProduct(query),
  });
}

export function useTopCustomers(query: DateRangeQuery & { limit?: number }) {
  return useQuery({
    queryKey: reportsKeys.topCustomers(query),
    queryFn: () => fetchTopCustomers(query),
  });
}

export function useInventoryAging(days: number) {
  return useQuery({
    queryKey: reportsKeys.inventoryAging(days),
    queryFn: () => fetchInventoryAging(days),
  });
}
