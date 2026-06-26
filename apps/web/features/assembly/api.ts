import { apiClient } from "@/lib/api-client";
import {
  AssemblyStatus,
  ComponentCategoryCode,
  ComponentStatus,
  FinishedPcStatus,
} from "@app/shared";

export enum AssemblyRole {
  CPU = "CPU",
  MB = "MB",
  RAM = "RAM",
  SSD = "SSD",
  HDD = "HDD",
  GPU = "GPU",
  PSU = "PSU",
  CASE = "CASE",
  FAN = "FAN",
  OTHER = "OTHER",
}

export interface AssemblyListItem {
  id: string;
  code: string;
  status: AssemblyStatus;
  notes?: string | null;
  repairCost: number;
  cleaningCost: number;
  assemblyCost: number;
  itemCount: number;
  totalCost: number;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  finishedPcs?: Array<{ id: string; code: string; status: FinishedPcStatus }>;
}

export interface AssemblyComponent {
  id: string;
  componentId: string;
  role: AssemblyRole;
  unitCost: number;
  component: {
    id: string;
    code: string;
    categoryCode: ComponentCategoryCode;
    model?: string | null;
    serial?: string | null;
    status: ComponentStatus;
    costPrice: number;
  };
}

export interface AssemblyDetail extends AssemblyListItem {
  components: AssemblyComponent[];
  componentsTotal: number;
  draftPcPreview: { costPrice: number };
}

export interface AssemblyListQuery {
  page?: number;
  pageSize?: number;
  status?: AssemblyStatus | "ALL";
  search?: string;
  fromDate?: string;
  toDate?: string;
}

export interface PaginatedAssemblies {
  items: AssemblyListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateAssemblyDto {
  name?: string;
  notes?: string;
  repairCost?: number;
  cleaningCost?: number;
  assemblyCost?: number;
  items: Array<{ componentId: string; role: AssemblyRole }>;
}

export interface UpdateAssemblyDto {
  name?: string;
  notes?: string;
  repairCost?: number;
  cleaningCost?: number;
  assemblyCost?: number;
  items?: Array<{ componentId: string; role: AssemblyRole }>;
}

function unwrap<T>(payload: any): T {
  return (payload?.data ?? payload) as T;
}

export async function listAssemblies(
  query: AssemblyListQuery = {},
): Promise<PaginatedAssemblies> {
  const params: Record<string, unknown> = { ...query };
  if (params.status === "ALL") delete params.status;
  const { data } = await apiClient.get("/assemblies", { params });
  return unwrap<PaginatedAssemblies>(data);
}

export async function getAssembly(id: string): Promise<AssemblyDetail> {
  const { data } = await apiClient.get(`/assemblies/${id}`);
  return unwrap<AssemblyDetail>(data);
}

export async function createAssembly(
  payload: CreateAssemblyDto,
): Promise<AssemblyDetail> {
  const { data } = await apiClient.post("/assemblies", payload);
  return unwrap<AssemblyDetail>(data);
}

export async function updateAssembly(
  id: string,
  payload: UpdateAssemblyDto,
): Promise<AssemblyDetail> {
  const { data } = await apiClient.patch(`/assemblies/${id}`, payload);
  return unwrap<AssemblyDetail>(data);
}

export async function startAssembly(id: string): Promise<AssemblyDetail> {
  const { data } = await apiClient.post(`/assemblies/${id}/start`);
  return unwrap<AssemblyDetail>(data);
}

export async function completeAssembly(id: string): Promise<AssemblyDetail> {
  const { data } = await apiClient.post(`/assemblies/${id}/complete`);
  return unwrap<AssemblyDetail>(data);
}

export async function cancelAssembly(id: string): Promise<AssemblyDetail> {
  const { data } = await apiClient.post(`/assemblies/${id}/cancel`);
  return unwrap<AssemblyDetail>(data);
}

export interface ComponentOption {
  id: string;
  code: string;
  categoryCode: ComponentCategoryCode;
  model?: string | null;
  serial?: string | null;
  costPrice: number;
  status: ComponentStatus;
}

export interface PaginatedComponents {
  items: ComponentOption[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function searchInStockComponents(
  search: string,
  categoryCode?: ComponentCategoryCode,
): Promise<ComponentOption[]> {
  const { data } = await apiClient.get("/components", {
    params: {
      search,
      pageSize: 50,
      status: ComponentStatus.IN_STOCK,
      categoryCode,
    },
  });
  const payload = unwrap<PaginatedComponents>(data);
  return payload.items ?? [];
}
