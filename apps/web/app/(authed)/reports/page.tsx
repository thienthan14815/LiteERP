"use client";

import * as React from "react";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfitReport } from "@/features/reports/hooks";
import { formatVnd, formatNumber, formatDate } from "@/lib/utils";

function firstDayOfMonthISO() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const [fromDraft, setFromDraft] = React.useState(firstDayOfMonthISO());
  const [toDraft, setToDraft] = React.useState(todayISO());
  const [fromDate, setFromDate] = React.useState(fromDraft);
  const [toDate, setToDate] = React.useState(toDraft);

  const { data, isLoading, isError } = useProfitReport({ fromDate, toDate });

  return (
    <div>
      <PageHeader
        title="Báo cáo lợi nhuận"
        description="Doanh thu, giá vốn và lợi nhuận theo khoảng thời gian"
      />

      <Card className="mb-4">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Từ ngày</label>
            <Input type="date" value={fromDraft} onChange={(e) => setFromDraft(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Đến ngày</label>
            <Input type="date" value={toDraft} onChange={(e) => setToDraft(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => { setFromDate(fromDraft); setToDate(toDraft); }}
            >
              Áp dụng
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : isError || !data ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Không tải được báo cáo.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard title="Doanh thu" value={formatVnd(data.revenue)} />
            <KpiCard title="Giá vốn" value={formatVnd(data.cost)} />
            <KpiCard title="Lợi nhuận" value={formatVnd(data.profit)} />
            <KpiCard title="Số đơn" value={formatNumber(data.salesCount)} />
          </div>
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              Khoảng thời gian: {formatDate(data.fromDate)} → {formatDate(data.toDate)}.
              Biểu đồ doanh thu / lợi nhuận sẽ được bổ sung ở phase báo cáo nâng cao.
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function KpiCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      <CardContent />
    </Card>
  );
}
