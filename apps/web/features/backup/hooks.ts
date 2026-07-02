"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteBackup,
  listBackups,
  restoreBackup,
  runBackup,
} from "./api";

export const backupKeys = { list: ["backup", "list"] as const };

export function useBackups() {
  return useQuery({ queryKey: backupKeys.list, queryFn: listBackups });
}

export function useRunBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: runBackup,
    onSuccess: () => qc.invalidateQueries({ queryKey: backupKeys.list }),
  });
}

export function useDeleteBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteBackup(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: backupKeys.list }),
  });
}

export function useRestoreBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => restoreBackup(file),
    onSuccess: () => {
      // Sau restore, mọi query cache đều stale — invalidate toàn bộ.
      qc.invalidateQueries();
    },
  });
}
