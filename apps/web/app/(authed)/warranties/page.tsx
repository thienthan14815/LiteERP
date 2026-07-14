"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
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
import { StatusBadge } from "@/components/tables/status-badge";
import { DataPagination } from "@/components/tables/data-pagination";
import { EmptyState } from "@/components/tables/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWarranties } from "@/features/warranty/hooks";
import { WARRANTY_STATUS_LABEL } from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import { WarrantyStatus } from "@app/shared";
import { usePageMeta } from "@/lib/page-title-context";

export default function WarrantiesPage() {
  usePageMeta("Bảo hành", "Yêu cầu bảo hành khách hàng");
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [searchDraft, setSearchDraft] = React.useState("");
  const [status, setStatus] = React.useState<"ALL" | WarrantyStatus>("ALL");
  const [fromDate, setFromDate] = React.useState<string>("");
  const [toDate, setToDate] = React.useState<string>("");

  const query = React.useMemo(
    () => ({
      page,
      pageSize: 20,
      search: search || undefined,
      status: status === "ALL" ? undefined : status,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    }),
    [page, search, status, fromDate, toDate],
  );

  const { data, isLoading } = useWarranties(query);

  return (
    <div>
      <PageHeader
        title="Bảo hành"
        description="Tra cứu và xử lý các đơn bảo hành"
        actions={
          <Link href="/warranties/new">
            <Button>+ Tạo đơn bảo hành</Button>
          </Link>
        }
      />

      <Card className="mb-4">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-5">
          <Input
            placeholder="Mã / mã máy / serial"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setSearch(searchDraft);
                setPage(1);
              }
            }}
          />
          <Select
            value={status}
            onValueChange={(v) => { setStatus(v as WarrantyStatus | "ALL"); setPage(1); }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tất cả trạng thái</SelectItem>
              {Object.values(WarrantyStatus).map((s) => (
                <SelectItem key={s} value={s}>{WARRANTY_STATUS_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} />
          <Input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} />
          <Button variant="secondary" onClick={() => { setSearch(searchDraft); setPage(1); }}>
            Tìm
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
            <EmptyState
              title="Chưa có đơn bảo hành"
              description="Tạo đơn mới khi khách mang máy đến bảo hành"
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã</TableHead>
                    <TableHead>Khách</TableHead>
                    <TableHead>Máy / linh kiện</TableHead>
                    <TableHead>Mô tả</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Ngày nhận</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((w) => (
                    <TableRow key={w.id} className="cursor-pointer">
                      <TableCell>
                        <Link href={`/warranties/detail?id=${w.id}`} className="font-medium hover:underline">
                          {w.code}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {w.customer?.name ?? "-"}
                        {w.customer?.phone ? (
                          <span className="block text-xs text-muted-foreground">{w.customer.phone}</span>
                        ) : null}
                      </TableCell>
                      <TableCell>{w.finishedPc?.code ?? "-"}</TableCell>
                      <TableCell className="max-w-[24ch] truncate">{w.description}</TableCell>
                      <TableCell>
                        <StatusBadge status={w.status} label={WARRANTY_STATUS_LABEL[w.status]} />
                      </TableCell>
                      <TableCell>{formatDate(w.receivedAt)}</TableCell>
                    </TableRow>
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
