"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { useDashboard } from "@/features/reports/hooks";
import { formatVnd, formatNumber } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string;
  description?: string;
  href?: string;
}

function KpiCard({ title, value, description, href }: KpiCardProps) {
  const inner = (
    <Card className={href ? "transition-colors hover:bg-accent/40" : undefined}>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      {description && (
        <CardContent className="pt-0 text-xs text-muted-foreground">
          {description}
        </CardContent>
      )}
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default function DashboardPage() {
  const { data, isLoading, isError, error } = useDashboard();

  return (
    <div>
      <PageHeader
        title="Tổng quan"
        description="Số liệu vận hành cửa hàng"
      />
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      )}
      {isError && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Không tải được số liệu: {(error as any)?.message ?? "lỗi không xác định"}
          </CardContent>
        </Card>
      )}
      {data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Doanh thu tháng"
            value={formatVnd(data.revenue)}
            href="/reports"
          />
          <KpiCard
            title="Lợi nhuận tháng"
            value={formatVnd(data.profit)}
            href="/reports"
          />
          <KpiCard
            title="Giá trị tồn kho"
            value={formatVnd(data.inventoryValue)}
          />
          <KpiCard
            title="Máy đang có"
            value={formatNumber(data.machineCount)}
          />
          <KpiCard
            title="Linh kiện tồn"
            value={formatNumber(data.componentCount)}
          />
          <KpiCard
            title="Máy chờ test"
            value={formatNumber(data.machinesWaitingTest)}
          />
          <KpiCard
            title="Đơn bảo hành"
            value={formatNumber(data.warrantyOpen)}
          />
        </div>
      )}
    </div>
  );
}
