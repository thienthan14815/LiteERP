"use client";

import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/tables/empty-state";
import {
  COMPONENT_CATEGORY_LABEL,
  COMPONENT_STATUS_LABEL,
} from "@/lib/labels";
import { formatNumber } from "@/lib/utils";
import { useInventorySummary } from "@/features/inventory/hooks";

export default function InventorySummaryPage() {
  const { data, isLoading, isError } = useInventorySummary();

  return (
    <div>
      <PageHeader title="Tổng quan kho" description="Số lượng theo trạng thái và loại" />
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
          <div>
            <h2 className="mb-3 text-sm font-semibold">Theo trạng thái</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {data.byStatus.map((row) => (
                <Card key={row.status}>
                  <CardHeader>
                    <CardDescription>
                      {COMPONENT_STATUS_LABEL[row.status]}
                    </CardDescription>
                    <CardTitle className="text-2xl">
                      {formatNumber(row.count)}
                    </CardTitle>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
          <div>
            <h2 className="mb-3 text-sm font-semibold">Theo loại</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {data.byCategory.map((row) => (
                <Card key={row.category}>
                  <CardHeader>
                    <CardDescription>
                      {COMPONENT_CATEGORY_LABEL[row.category]}
                    </CardDescription>
                    <CardTitle className="text-2xl">
                      {formatNumber(row.count)}
                    </CardTitle>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
