"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteComponent,
  deleteMachine,
  disassembleMachine,
  getComponent,
  getInventorySummary,
  getInventoryValue,
  getMachine,
  inspectMachine,
  listComponents,
  listMachines,
  listStockTransactions,
  markMachineReadyForSale,
  scrapComponent,
  updateComponent,
  updateMachine,
  type ComponentListQuery,
  type InspectMachineDto,
  type MachineListQuery,
  type StockTxnListQuery,
  type UpdateComponentDto,
  type UpdateMachineDto,
} from "./api";

export const machineKeys = {
  all: ["machines"] as const,
  list: (q: MachineListQuery) => ["machines", "list", q] as const,
  detail: (id: string) => ["machines", "detail", id] as const,
};

export const componentKeys = {
  all: ["components"] as const,
  list: (q: ComponentListQuery) => ["components", "list", q] as const,
  detail: (id: string) => ["components", "detail", id] as const,
};

export const inventoryKeys = {
  summary: ["inventory", "summary"] as const,
  value: ["inventory", "value"] as const,
  transactions: (q: StockTxnListQuery) =>
    ["inventory", "transactions", q] as const,
};

export function useMachines(query: MachineListQuery) {
  return useQuery({
    queryKey: machineKeys.list(query),
    queryFn: () => listMachines(query),
  });
}

export function useMachine(id: string | undefined) {
  return useQuery({
    queryKey: id ? machineKeys.detail(id) : ["machines", "detail", "none"],
    queryFn: () => getMachine(id!),
    enabled: !!id,
  });
}

export function useInspectMachine(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: InspectMachineDto) => inspectMachine(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: machineKeys.all });
      qc.invalidateQueries({ queryKey: machineKeys.detail(id) });
    },
  });
}

export function useDisassembleMachine(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => disassembleMachine(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: machineKeys.all });
      qc.invalidateQueries({ queryKey: componentKeys.all });
      qc.invalidateQueries({ queryKey: machineKeys.detail(id) });
    },
  });
}

export function useMarkMachineReady(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => markMachineReadyForSale(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: machineKeys.all });
      qc.invalidateQueries({ queryKey: machineKeys.detail(id) });
      // Máy lên kệ = một bản ghi mới trong mục PC thành phẩm.
      qc.invalidateQueries({ queryKey: ["finished-pcs"] });
    },
  });
}

export function useUpdateMachine(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateMachineDto) => updateMachine(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: machineKeys.all });
      qc.invalidateQueries({ queryKey: machineKeys.detail(id) });
    },
  });
}

export function useDeleteMachine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMachine(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: machineKeys.all });
    },
  });
}

export function useComponents(query: ComponentListQuery) {
  return useQuery({
    queryKey: componentKeys.list(query),
    queryFn: () => listComponents(query),
  });
}

export function useComponent(id: string | undefined) {
  return useQuery({
    queryKey: id ? componentKeys.detail(id) : ["components", "detail", "none"],
    queryFn: () => getComponent(id!),
    enabled: !!id,
  });
}

export function useScrapComponent(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => scrapComponent(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: componentKeys.all });
      qc.invalidateQueries({ queryKey: componentKeys.detail(id) });
    },
  });
}

export function useUpdateComponent(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateComponentDto) => updateComponent(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: componentKeys.all });
      qc.invalidateQueries({ queryKey: componentKeys.detail(id) });
    },
  });
}

export function useDeleteComponent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteComponent(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: componentKeys.all });
    },
  });
}

export function useStockTransactions(query: StockTxnListQuery) {
  return useQuery({
    queryKey: inventoryKeys.transactions(query),
    queryFn: () => listStockTransactions(query),
  });
}

export function useInventorySummary() {
  return useQuery({
    queryKey: inventoryKeys.summary,
    queryFn: getInventorySummary,
  });
}

export function useInventoryValue() {
  return useQuery({
    queryKey: inventoryKeys.value,
    queryFn: getInventoryValue,
  });
}
