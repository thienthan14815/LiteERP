import { apiClient } from "@/lib/api-client";

export type MasterOptionType = "SELLER" | "SALES_PLATFORM";

export interface MasterOption {
  id: string;
  type: MasterOptionType;
  name: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMasterOptionInput {
  type: MasterOptionType;
  name: string;
  notes?: string;
}

export interface UpdateMasterOptionInput {
  name?: string;
  notes?: string;
}

function unwrap<T>(p: any): T {
  return (p?.data ?? p) as T;
}

export async function listMasterOptions(
  type?: MasterOptionType,
): Promise<MasterOption[]> {
  const { data } = await apiClient.get("/master-options", {
    params: type ? { type } : {},
  });
  return unwrap<MasterOption[]>(data);
}

export async function createMasterOption(
  payload: CreateMasterOptionInput,
): Promise<MasterOption> {
  const { data } = await apiClient.post("/master-options", payload);
  return unwrap<MasterOption>(data);
}

export async function updateMasterOption(
  id: string,
  payload: UpdateMasterOptionInput,
): Promise<MasterOption> {
  const { data } = await apiClient.patch(`/master-options/${id}`, payload);
  return unwrap<MasterOption>(data);
}

export async function deleteMasterOption(id: string): Promise<void> {
  await apiClient.delete(`/master-options/${id}`);
}
