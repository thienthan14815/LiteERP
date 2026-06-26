"use client";

import * as React from "react";
import Link from "next/link";
import { FinishedPcStatus } from "@app/shared";
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
import { FINISHED_PC_STATUS_LABEL } from "@/lib/labels";
import { formatVnd, formatDate } from "@/lib/utils";
import { useFinishedPcs } from "@/features/finished-pc/hooks";
import { usePageMeta } from "@/lib/page-title-context";

const STATUS_OPTIONS: Array<{ value: FinishedPcStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "Tất cả" },
  ...Object.values(FinishedPcStatus).map((s) => ({
    value: s,
    label: FINISHED_PC_STATUS_LABEL[s] ?? s,
  })),
];

export default function FinishedPcsListPage() {
  usePageMeta("Máy thành phẩm", "PC sau lắp ráp");
  const [page, setPage] = React.useState(1);
  const [pageSize] = React.useState(20);
  const [status, setStatus] = React.useState<FinishedPcStatus | "ALL">("ALL");
  const [search, setSearch] = React.useState("");
  const [searchDraft, setSearchDraft] = React.useState("");

  const query = React.useMemo(
    () => ({ page, pageSize, status, search }),
    [page, pageSize, status, search],
  );
  const { data, isLoading, isError } = useFinishedPcs(query);

  return (
    <div>
      <PageHeader
        title="Máy thành phẩm"
        description="Danh sách máy đã lắp ráp và bán"
      />

      <Card className="mb-4">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Tìm kiếm</label>
            <Input
              placeholder="Mã máy"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && (setSearch(searchDraft), setPage(1))
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Trạng thái</label>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v as FinishedPcStatus | "ALL");
                setPage(1);
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              variant="secondary"
              onClick={() => { setSearch(searchDraft); setPage(1); }}
              className="w-full"
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
            <EmptyState title="Không tải được dữ liệu" description="Vui lòng thử lại" />
          ) : !data || data.items.length === 0 ? (
            <EmptyState title="Chưa có máy thành phẩm nào" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã</TableHead>
                  <TableHead>Ngày tạo</TableHead>
                  <TableHead className="text-right">LK</TableHead>
                  <TableHead className="text-right">Giá vốn</TableHead>
                  <TableHead className="text-right">Giá đề xuất</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.code}</TableCell>
                    <TableCell>{formatDate(row.createdAt)}</TableCell>
                    <TableCell className="text-right">{row.componentCount}</TableCell>
                    <TableCell className="text-right">
                      {formatVnd(row.costPrice)}
                    </TableCell>
                    <TableCell className="text-right">
                      {Number(row.suggestedPrice) > 0
                        ? formatVnd(row.suggestedPrice)
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        status={row.status}
                        label={FINISHED_PC_STATUS_LABEL[row.status]}
                      />
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/finished-pcs/${row.id}`}>Xem</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {data && data.items.length > 0 && (
          <div className="px-4">
            <DataPagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              onPageChange={setPage}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
