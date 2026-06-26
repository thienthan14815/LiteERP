"use client";

import * as React from "react";
import Link from "next/link";
import { MachineStatus } from "@app/shared";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/tables/status-badge";
import { EmptyState } from "@/components/tables/empty-state";
import { DataPagination } from "@/components/tables/data-pagination";
import { MACHINE_STATUS_LABEL } from "@/lib/labels";
import { formatVnd, formatDate } from "@/lib/utils";
import { useMachines } from "@/features/inventory/hooks";
import { usePageMeta } from "@/lib/page-title-context";

const STATUS_OPTS: Array<{ value: MachineStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "Tất cả" },
  ...Object.values(MachineStatus).map((s) => ({
    value: s,
    label: MACHINE_STATUS_LABEL[s],
  })),
];

export default function MachinesListPage() {
  usePageMeta("Máy tính", "Quản lý máy cũ thu mua");
  const [page, setPage] = React.useState(1);
  const [status, setStatus] = React.useState<MachineStatus | "ALL">("ALL");
  const [search, setSearch] = React.useState("");
  const [searchDraft, setSearchDraft] = React.useState("");

  const query = React.useMemo(
    () => ({ page, pageSize: 20, status, search }),
    [page, status, search],
  );

  const { data, isLoading, isError } = useMachines(query);

  return (
    <div>
      <PageHeader title="Máy mua vào" description="Danh sách máy cũ" />
      <Card className="mb-4">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Tìm kiếm</label>
            <Input
              placeholder="Mã / serial"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setSearch(searchDraft);
                  setPage(1);
                }
              }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Trạng thái</label>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v as MachineStatus | "ALL");
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                setSearch(searchDraft);
                setPage(1);
              }}
            >
              Lọc
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : isError ? (
            <EmptyState title="Không tải được dữ liệu" />
          ) : !data || data.data.length === 0 ? (
            <EmptyState title="Chưa có máy nào" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã</TableHead>
                  <TableHead>Serial</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Ngày nhập</TableHead>
                  <TableHead className="text-right">Giá mua</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.code}</TableCell>
                    <TableCell>{m.serial ?? "-"}</TableCell>
                    <TableCell>{m.model ?? "-"}</TableCell>
                    <TableCell>{formatDate(m.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      {formatVnd(m.purchasePrice)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        status={m.status}
                        label={MACHINE_STATUS_LABEL[m.status]}
                      />
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/machines/${m.id}`}>Xem</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {data && data.data.length > 0 && (
          <div className="px-4">
            <DataPagination
              page={data.meta.page}
              pageSize={data.meta.pageSize}
              total={data.meta.total}
              onPageChange={setPage}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
