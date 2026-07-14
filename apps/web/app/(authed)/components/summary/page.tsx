"use client";

import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/tables/empty-state";
import {
  COMPONENT_CATEGORY_LABEL,
  COMPONENT_STATUS_LABEL,
  FINISHED_PC_STATUS_LABEL,
  MACHINE_STATUS_LABEL,
} from "@/lib/labels";
import { formatNumber } from "@/lib/utils";
import { useInventorySummary } from "@/features/inventory/hooks";

/** Record<status, count> → mảng card, sort giảm dần theo số lượng. */
function statusCards(
  map: Record<string, number> | undefined,
  labels: Record<string, string>,
): Array<{ key: string; label: string; count: number }> {
  return Object.entries(map ?? {})
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ key, label: labels[key] ?? key, count }));
}

function CardGrid({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: Array<{ key: string; label: string; count: number }>;
  emptyText: string;
}) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          {emptyText}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((row) => (
            <Card key={row.key}>
              <CardHeader>
                <CardDescription>{row.label}</CardDescription>
                <CardTitle className="text-2xl">
                  {formatNumber(row.count)}
                </CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function InventorySummaryPage() {
  const { data, isLoading, isError } = useInventorySummary();

  return (
    <div>
      <PageHeader
        title="Tổng quan kho"
        description="Máy, PC thành phẩm và linh kiện theo trạng thái"
      />
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : isError || !data ? (
        <EmptyState title="Không tải được số liệu" />
      ) : (
        <div className="space-y-6">
          <CardGrid
            title="Máy cũ nhập kho"
            items={statusCards(data.machines, MACHINE_STATUS_LABEL as Record<string, string>)}
            emptyText="Chưa có máy nào — máy xuất hiện sau khi xác nhận phiếu mua có mục Máy bộ/PC/Laptop."
          />
          <CardGrid
            title="PC thành phẩm"
            items={statusCards(data.finishedPcs, FINISHED_PC_STATUS_LABEL as Record<string, string>)}
            emptyText="Chưa có PC thành phẩm — tạo từ phiếu lắp ráp hoặc chọn 'Để nguyên — bán máy' ở máy cũ."
          />
          <CardGrid
            title="Linh kiện theo trạng thái"
            items={data.byStatus.map((r) => ({
              key: r.status,
              label: COMPONENT_STATUS_LABEL[r.status] ?? r.status,
              count: r.count,
            }))}
            emptyText="Chưa có linh kiện trong kho — linh kiện xuất hiện khi mua linh kiện rời hoặc tháo máy cũ."
          />
          <CardGrid
            title="Linh kiện theo loại"
            items={data.byCategory.map((r) => ({
              key: r.category,
              label: COMPONENT_CATEGORY_LABEL[r.category] ?? r.category,
              count: r.count,
            }))}
            emptyText="Chưa có linh kiện trong kho."
          />
        </div>
      )}
    </div>
  );
}
