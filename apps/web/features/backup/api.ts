import { apiClient } from "@/lib/api-client";

export type BackupKind = "DAILY" | "WEEKLY" | "MONTHLY";

export interface BackupItem {
  id: string;
  filename: string;
  sizeBytes: number;
  kind: BackupKind;
  createdAt: string;
}

export interface BackupRunResult {
  id: string;
  filename: string;
  sizeBytes: number;
  kind: BackupKind;
  uploadedAt: string;
  retention: { deleted: number; kept: number };
}

export interface RestoreResult {
  restoredFrom: string;
  sizeBytes: number;
  durationMs: number;
}

export async function runBackup(): Promise<BackupRunResult> {
  const { data } = await apiClient.post("/backup/run");
  return (data?.data ?? data) as BackupRunResult;
}

export async function listBackups(): Promise<BackupItem[]> {
  const { data } = await apiClient.get("/backup");
  const payload = (data?.data ?? data) as BackupItem[];
  return Array.isArray(payload) ? payload : [];
}

export async function deleteBackup(id: string): Promise<void> {
  await apiClient.delete(`/backup/${id}`);
}

export async function restoreBackup(file: File): Promise<RestoreResult> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post("/backup/restore", form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 10 * 60 * 1000, // Restore có thể mất vài phút.
  });
  return (data?.data ?? data) as RestoreResult;
}
