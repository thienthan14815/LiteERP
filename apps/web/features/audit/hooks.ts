"use client";

import { useQuery } from "@tanstack/react-query";
import { listAuditLogs, type AuditLogQuery } from "./api";

export function useAuditLogs(query: AuditLogQuery) {
  return useQuery({
    queryKey: ["audit-logs", query],
    queryFn: () => listAuditLogs(query),
  });
}
