"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelSale,
  confirmSale,
  createSale,
  getSale,
  listSales,
  updateSale,
  type CreateSaleDto,
  type SaleListQuery,
  type UpdateSaleDto,
} from "./api";

export const saleKeys = {
  all: ["sales"] as const,
  list: (q: SaleListQuery) => ["sales", "list", q] as const,
  detail: (id: string) => ["sales", "detail", id] as const,
};

export function useSales(query: SaleListQuery) {
  return useQuery({
    queryKey: saleKeys.list(query),
    queryFn: () => listSales(query),
  });
}

export function useSale(id: string | undefined) {
  return useQuery({
    queryKey: id ? saleKeys.detail(id) : ["sales", "detail", "none"],
    queryFn: () => getSale(id!),
    enabled: !!id,
  });
}

export function useCreateSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSaleDto) => createSale(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: saleKeys.all }),
  });
}

export function useUpdateSale(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateSaleDto) => updateSale(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: saleKeys.detail(id) });
      qc.invalidateQueries({ queryKey: saleKeys.all });
    },
  });
}

export function useConfirmSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => confirmSale(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: saleKeys.detail(data.id) });
      qc.invalidateQueries({ queryKey: saleKeys.all });
    },
  });
}

export function useCancelSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelSale(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: saleKeys.detail(data.id) });
      qc.invalidateQueries({ queryKey: saleKeys.all });
    },
  });
}
