import { apiClient } from "@/lib/api-client";

export interface AuditLogRow {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeJson: unknown;
  afterJson: unknown;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditLogQuery {
  page?: number;
  pageSize?: number;
  actorId?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  fromDate?: string;
  toDate?: string;
}

export interface PaginatedAuditLogs {
  items: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function unwrap<T>(p: any): T {
  return (p?.data ?? p) as T;
}

export async function listAuditLogs(q: AuditLogQuery = {}): Promise<PaginatedAuditLogs> {
  const { data } = await apiClient.get("/audit-logs", { params: q });
  return unwrap<PaginatedAuditLogs>(data);
}
