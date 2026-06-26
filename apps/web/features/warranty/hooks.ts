"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelWarranty,
  createWarranty,
  getWarranty,
  listWarranties,
  replaceWarrantyComponent,
  transitionWarranty,
  type CreateWarrantyDto,
  type ReplaceComponentDto,
  type WarrantyListQuery,
} from "./api";
import type { WarrantyStatus } from "@app/shared";

export const warrantyKeys = {
  all: ["warranties"] as const,
  list: (q: WarrantyListQuery) => ["warranties", "list", q] as const,
  detail: (id: string) => ["warranties", "detail", id] as const,
};

export function useWarranties(query: WarrantyListQuery) {
  return useQuery({
    queryKey: warrantyKeys.list(query),
    queryFn: () => listWarranties(query),
  });
}

export function useWarranty(id: string | undefined) {
  return useQuery({
    queryKey: id ? warrantyKeys.detail(id) : ["warranties", "detail", "none"],
    queryFn: () => getWarranty(id!),
    enabled: !!id,
  });
}

export function useCreateWarranty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateWarrantyDto) => createWarranty(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: warrantyKeys.all }),
  });
}

export function useTransitionWarranty(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { to: WarrantyStatus; notes?: string }) =>
      transitionWarranty(id, payload.to, payload.notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: warrantyKeys.detail(id) });
      qc.invalidateQueries({ queryKey: warrantyKeys.all });
    },
  });
}

export function useCancelWarranty(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => cancelWarranty(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: warrantyKeys.detail(id) });
      qc.invalidateQueries({ queryKey: warrantyKeys.all });
    },
  });
}

export function useReplaceWarrantyComponent(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ReplaceComponentDto) => replaceWarrantyComponent(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: warrantyKeys.detail(id) });
      qc.invalidateQueries({ queryKey: warrantyKeys.all });
    },
  });
}
