"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelAssembly,
  completeAssembly,
  createAssembly,
  getAssembly,
  listAssemblies,
  startAssembly,
  updateAssembly,
  type AssemblyListQuery,
  type CreateAssemblyDto,
  type UpdateAssemblyDto,
} from "./api";

export const assemblyKeys = {
  all: ["assemblies"] as const,
  list: (q: AssemblyListQuery) => ["assemblies", "list", q] as const,
  detail: (id: string) => ["assemblies", "detail", id] as const,
};

export function useAssemblies(query: AssemblyListQuery) {
  return useQuery({
    queryKey: assemblyKeys.list(query),
    queryFn: () => listAssemblies(query),
  });
}

export function useAssembly(id: string | undefined) {
  return useQuery({
    queryKey: id ? assemblyKeys.detail(id) : ["assemblies", "detail", "none"],
    queryFn: () => getAssembly(id!),
    enabled: !!id,
  });
}

export function useCreateAssembly() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAssemblyDto) => createAssembly(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: assemblyKeys.all });
    },
  });
}

export function useUpdateAssembly(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateAssemblyDto) => updateAssembly(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: assemblyKeys.all });
      qc.invalidateQueries({ queryKey: assemblyKeys.detail(id) });
    },
  });
}

export function useStartAssembly() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => startAssembly(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: assemblyKeys.all });
      qc.invalidateQueries({ queryKey: assemblyKeys.detail(data.id) });
    },
  });
}

export function useCompleteAssembly() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => completeAssembly(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: assemblyKeys.all });
      qc.invalidateQueries({ queryKey: assemblyKeys.detail(data.id) });
    },
  });
}

export function useCancelAssembly() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelAssembly(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: assemblyKeys.all });
      qc.invalidateQueries({ queryKey: assemblyKeys.detail(data.id) });
    },
  });
}
