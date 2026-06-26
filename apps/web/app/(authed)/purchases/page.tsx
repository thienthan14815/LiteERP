"use client";

import * as React from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PurchaseOrderStatus } from "@app/shared";
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
import { Can } from "@/features/auth/can";
import { PERM } from "@/lib/permissions";
import { PURCHASE_ORDER_STATUS_LABEL } from "@/lib/labels";
import { formatVnd, formatDate } from "@/lib/utils";
import { usePurchases } from "@/features/purchase/hooks";

const STATUS_OPTIONS: Array<{ value: PurchaseOrderStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "Tất cả" },
  { value: PurchaseOrderStatus.DRAFT, label: "Nháp" },
  { value: PurchaseOrderStatus.CONFIRMED, label: "Đã xác nhận" },
  { value: PurchaseOrderStatus.CANCELLED, label: "Đã hủy" },
];

export default function PurchasesListPage() {
  const [page, setPage] = React.useState(1);
  const [pageSize] = React.useState(20);
  const [status, setStatus] = React.useState<PurchaseOrderStatus | "ALL">("ALL");
  const [search, setSearch] = React.useState("");
  const [searchDraft, setSearchDraft] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");

  const query = React.useMemo(
    () => ({ page, pageSize, status, search, from, to }),
    [page, pageSize, status, search, from, to],
  );

  const { data, isLoading, isError } = usePurchases(query);

  const applySearch = () => {
    setSearch(searchDraft);
    setPage(1);
  };

  return (
    <div>
      <PageHeader
        title="Phiếu mua hàng"
        description="Quản lý phiếu mua máy cũ và linh kiện"
        actions={
          <Can permission={PERM.PURCHASE_CREATE}>
            <Button asChild>
              <Link href="/purchases/new">
                <Plus className="mr-2 h-4 w-4" />
                Tạo phiếu mua
              </Link>
            </Button>
          </Can>
        }
      />

      <Card className="mb-4">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Tìm kiếm</label>
            <Input
              placeholder="Mã / nhà cung cấp"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applySearch()}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Trạng thái</label>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v as PurchaseOrderStatus | "ALL");
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Từ ngày</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Đến ngày</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button variant="secondary" onClick={applySearch} className="w-full">
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
            <EmptyState
              title="Không tải được dữ liệu"
              description="Vui lòng thử lại"
            />
          ) : !data || data.data.length === 0 ? (
            <EmptyState title="Chưa có phiếu mua nào" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã</TableHead>
                  <TableHead>Ngày</TableHead>
                  <TableHead>Nhà cung cấp</TableHead>
                  <TableHead className="text-right">Tổng tiền</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.code}</TableCell>
                    <TableCell>{formatDate(row.createdAt)}</TableCell>
                    <TableCell>{row.supplier?.name ?? row.supplierName ?? "-"}</TableCell>
                    <TableCell className="text-right">
                      {formatVnd(row.totalAmount)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        status={row.status}
                        label={PURCHASE_ORDER_STATUS_LABEL[row.status]}
                      />
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/purchases/${row.id}`}>Xem</Link>
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
