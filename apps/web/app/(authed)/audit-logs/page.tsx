"use client";

import * as React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataPagination } from "@/components/tables/data-pagination";
import { EmptyState } from "@/components/tables/empty-state";
import { useAuditLogs } from "@/features/audit/hooks";
import { formatDateTime } from "@/lib/utils";

export default function AuditLogsPage() {
  const [page, setPage] = React.useState(1);
  const [filters, setFilters] = React.useState({
    actorId: "",
    entityType: "",
    entityId: "",
    action: "",
    fromDate: "",
    toDate: "",
  });
  const [applied, setApplied] = React.useState(filters);

  const query = React.useMemo(
    () => ({
      page,
      pageSize: 20,
      actorId: applied.actorId || undefined,
      entityType: applied.entityType || undefined,
      entityId: applied.entityId || undefined,
      action: applied.action || undefined,
      fromDate: applied.fromDate || undefined,
      toDate: applied.toDate || undefined,
    }),
    [page, applied],
  );

  const { data, isLoading } = useAuditLogs(query);
  const [expanded, setExpanded] = React.useState<string | null>(null);

  return (
    <div>
      <PageHeader title="Nhật ký hệ thống" description="Audit log của các hành động" />

      <Card className="mb-4">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
          <Input placeholder="Actor ID" value={filters.actorId} onChange={(e) => setFilters((f) => ({ ...f, actorId: e.target.value }))} />
          <Input placeholder="Entity type" value={filters.entityType} onChange={(e) => setFilters((f) => ({ ...f, entityType: e.target.value }))} />
          <Input placeholder="Entity ID" value={filters.entityId} onChange={(e) => setFilters((f) => ({ ...f, entityId: e.target.value }))} />
          <Input placeholder="Action" value={filters.action} onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))} />
          <Input type="date" value={filters.fromDate} onChange={(e) => setFilters((f) => ({ ...f, fromDate: e.target.value }))} />
          <Input type="date" value={filters.toDate} onChange={(e) => setFilters((f) => ({ ...f, toDate: e.target.value }))} />
          <Button variant="secondary" onClick={() => { setApplied(filters); setPage(1); }} className="sm:col-span-3 lg:col-span-6">
            Áp dụng bộ lọc
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !data || data.items.length === 0 ? (
            <EmptyState title="Không có nhật ký" />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Thời gian</TableHead>
                    <TableHead>Hành động</TableHead>
                    <TableHead>Đối tượng</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((r) => (
                    <React.Fragment key={r.id}>
                      <TableRow>
                        <TableCell>{formatDateTime(r.createdAt)}</TableCell>
                        <TableCell><code className="text-xs">{r.action}</code></TableCell>
                        <TableCell>
                          <span className="font-medium">{r.entityType}</span>
                          <br />
                          <span className="text-xs text-muted-foreground">{r.entityId}</span>
                        </TableCell>
                        <TableCell><code className="text-xs">{r.actorUserId ?? "system"}</code></TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                            {expanded === r.id ? "Đóng" : "Chi tiết"}
                          </Button>
                        </TableCell>
                      </TableRow>
                      {expanded === r.id && (
                        <TableRow>
                          <TableCell colSpan={5} className="bg-muted/30">
                            <div className="grid gap-4 p-2 md:grid-cols-2">
                              <div>
                                <p className="mb-1 text-xs font-semibold text-muted-foreground">Before</p>
                                <pre className="max-h-96 overflow-auto rounded bg-background p-2 text-xs">
                                  {r.beforeJson ? JSON.stringify(r.beforeJson, null, 2) : "—"}
                                </pre>
                              </div>
                              <div>
                                <p className="mb-1 text-xs font-semibold text-muted-foreground">After</p>
                                <pre className="max-h-96 overflow-auto rounded bg-background p-2 text-xs">
                                  {r.afterJson ? JSON.stringify(r.afterJson, null, 2) : "—"}
                                </pre>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
              <div className="px-4">
                <DataPagination
                  page={data.page}
                  pageSize={data.pageSize}
                  total={data.total}
                  onPageChange={setPage}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
