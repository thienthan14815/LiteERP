"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FinishedPcStatus } from "@app/shared";
import {
  getFinishedPc,
  listFinishedPcs,
  scrapFinishedPc,
  transitionFinishedPc,
  updateFinishedPc,
  type FinishedPcListQuery,
  type UpdateFinishedPcDto,
} from "./api";

export const finishedPcKeys = {
  all: ["finished-pcs"] as const,
  list: (q: FinishedPcListQuery) => ["finished-pcs", "list", q] as const,
  detail: (id: string) => ["finished-pcs", "detail", id] as const,
};

export function useFinishedPcs(query: FinishedPcListQuery) {
  return useQuery({
    queryKey: finishedPcKeys.list(query),
    queryFn: () => listFinishedPcs(query),
  });
}

export function useFinishedPc(id: string | undefined) {
  return useQuery({
    queryKey: id ? finishedPcKeys.detail(id) : ["finished-pcs", "detail", "none"],
    queryFn: () => getFinishedPc(id!),
    enabled: !!id,
  });
}

export function useUpdateFinishedPc(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateFinishedPcDto) => updateFinishedPc(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: finishedPcKeys.detail(id) });
      qc.invalidateQueries({ queryKey: finishedPcKeys.all });
    },
  });
}

export function useTransitionFinishedPc(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (to: FinishedPcStatus) => transitionFinishedPc(id, to),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: finishedPcKeys.detail(id) });
      qc.invalidateQueries({ queryKey: finishedPcKeys.all });
    },
  });
}

export function useScrapFinishedPc(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => scrapFinishedPc(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: finishedPcKeys.detail(id) });
      qc.invalidateQueries({ queryKey: finishedPcKeys.all });
    },
  });
}
