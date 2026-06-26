"use client";

import * as React from "react";
import { StockTxnType } from "@app/shared";
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
import { EmptyState } from "@/components/tables/empty-state";
import { DataPagination } from "@/components/tables/data-pagination";
import { STOCK_TXN_TYPE_LABEL } from "@/lib/labels";
import { formatDateTime } from "@/lib/utils";
import { useStockTransactions } from "@/features/inventory/hooks";

export default function StockTransactionsPage() {
  const [page, setPage] = React.useState(1);
  const [type, setType] = React.useState<StockTxnType | "ALL">("ALL");
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");
  const query = React.useMemo(
    () => ({ page, pageSize: 20, type, fromDate, toDate }),
    [page, type, fromDate, toDate],
  );
  const { data, isLoading, isError } = useStockTransactions(query);

  return (
    <div>
      <PageHeader
        title="Lịch sử kho"
        description="Tất cả nhập / xuất / điều chỉnh"
      />
      <Card className="mb-4">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Loại</label>
            <Select
              value={type}
              onValueChange={(v) => {
                setType(v as StockTxnType | "ALL");
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tất cả</SelectItem>
                {Object.values(StockTxnType).map((t) => (
                  <SelectItem key={t} value={t}>
                    {STOCK_TXN_TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Từ</label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Đến</label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button variant="secondary" className="w-full" onClick={() => setPage(1)}>
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
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : isError ? (
            <EmptyState title="Không tải được dữ liệu" />
          ) : !data || data.data.length === 0 ? (
            <EmptyState title="Không có giao dịch" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>Linh kiện</TableHead>
                  <TableHead>Lý do</TableHead>
                  <TableHead>Tham chiếu</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{formatDateTime(t.createdAt)}</TableCell>
                    <TableCell>{STOCK_TXN_TYPE_LABEL[t.type]}</TableCell>
                    <TableCell>{t.componentCode ?? t.componentId}</TableCell>
                    <TableCell>{t.reason ?? "-"}</TableCell>
                    <TableCell>{t.reference ?? "-"}</TableCell>
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
