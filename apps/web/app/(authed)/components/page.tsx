"use client";

import * as React from "react";
import Link from "next/link";
import {
  ComponentCategoryCode,
  ComponentCondition,
  ComponentStatus,
} from "@app/shared";
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
import {
  COMPONENT_CATEGORY_LABEL,
  COMPONENT_CONDITION_LABEL,
  COMPONENT_STATUS_LABEL,
} from "@/lib/labels";
import { formatVnd } from "@/lib/utils";
import { useComponents } from "@/features/inventory/hooks";
import { usePageMeta } from "@/lib/page-title-context";

export default function ComponentsListPage() {
  usePageMeta("Linh kiện", "Kho linh kiện trong hệ thống");
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [searchDraft, setSearchDraft] = React.useState("");
  const [category, setCategory] = React.useState<ComponentCategoryCode | "ALL">("ALL");
  const [status, setStatus] = React.useState<ComponentStatus | "ALL">("ALL");
  const [condition, setCondition] = React.useState<ComponentCondition | "ALL">("ALL");

  const query = React.useMemo(
    () => ({ page, pageSize: 20, search, category, status, condition }),
    [page, search, category, status, condition],
  );
  const { data, isLoading, isError } = useComponents(query);

  return (
    <div>
      <PageHeader
        title="Kho linh kiện"
        description="Quản lý từng linh kiện theo mã & serial"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/components/transactions">Lịch sử kho</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/components/summary">Tổng quan</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/components/value">Giá trị kho</Link>
            </Button>
          </div>
        }
      />

      <Card className="mb-4">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Tìm kiếm</label>
            <Input
              placeholder="Serial / mã / model"
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
            <label className="mb-1 block text-xs text-muted-foreground">Loại</label>
            <Select
              value={category}
              onValueChange={(v) => {
                setCategory(v as ComponentCategoryCode | "ALL");
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tất cả</SelectItem>
                {Object.values(ComponentCategoryCode).map((c) => (
                  <SelectItem key={c} value={c}>
                    {COMPONENT_CATEGORY_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Trạng thái</label>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v as ComponentStatus | "ALL");
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tất cả</SelectItem>
                {Object.values(ComponentStatus).map((s) => (
                  <SelectItem key={s} value={s}>
                    {COMPONENT_STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Tình trạng</label>
            <Select
              value={condition}
              onValueChange={(v) => {
                setCondition(v as ComponentCondition | "ALL");
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tất cả</SelectItem>
                {Object.values(ComponentCondition).map((c) => (
                  <SelectItem key={c} value={c}>
                    {COMPONENT_CONDITION_LABEL[c]}
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
            <EmptyState title="Không có linh kiện nào" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã</TableHead>
                  <TableHead>Serial</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Giá vốn</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.code}</TableCell>
                    <TableCell>{c.serial ?? "-"}</TableCell>
                    <TableCell>
                      {COMPONENT_CATEGORY_LABEL[c.categoryCode]}
                    </TableCell>
                    <TableCell>{c.model ?? "-"}</TableCell>
                    <TableCell className="text-right">
                      {formatVnd(c.costPrice ?? 0)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        status={c.status}
                        label={COMPONENT_STATUS_LABEL[c.status]}
                      />
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/components/${c.id}`}>Xem</Link>
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
