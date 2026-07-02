"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelPurchase,
  confirmPurchase,
  createPurchase,
  deletePurchaseItem,
  getPurchase,
  listPurchases,
  updatePurchaseItem,
  type CreatePurchaseDto,
  type PurchaseListQuery,
  type UpdatePurchaseItemInput,
} from "./api";

export const purchaseKeys = {
  all: ["purchases"] as const,
  list: (q: PurchaseListQuery) => ["purchases", "list", q] as const,
  detail: (id: string) => ["purchases", "detail", id] as const,
};

export function usePurchases(query: PurchaseListQuery) {
  return useQuery({
    queryKey: purchaseKeys.list(query),
    queryFn: () => listPurchases(query),
  });
}

export function usePurchase(id: string | undefined) {
  return useQuery({
    queryKey: id ? purchaseKeys.detail(id) : ["purchases", "detail", "none"],
    queryFn: () => getPurchase(id!),
    enabled: !!id,
  });
}

export function useCreatePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePurchaseDto) => createPurchase(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: purchaseKeys.all });
    },
  });
}

export function useConfirmPurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => confirmPurchase(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: purchaseKeys.all });
      qc.invalidateQueries({ queryKey: purchaseKeys.detail(data.id) });
    },
  });
}

export function useCancelPurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelPurchase(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: purchaseKeys.all });
      qc.invalidateQueries({ queryKey: purchaseKeys.detail(data.id) });
    },
  });
}

export function useUpdatePurchaseItem(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { itemId: string; payload: UpdatePurchaseItemInput }) =>
      updatePurchaseItem(orderId, params.itemId, params.payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: purchaseKeys.detail(orderId) });
      qc.invalidateQueries({ queryKey: purchaseKeys.all });
    },
  });
}

export function useDeletePurchaseItem(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => deletePurchaseItem(orderId, itemId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: purchaseKeys.detail(orderId) });
      qc.invalidateQueries({ queryKey: purchaseKeys.all });
    },
  });
}
