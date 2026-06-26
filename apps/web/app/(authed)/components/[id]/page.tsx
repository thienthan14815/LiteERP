"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ComponentStatus } from "@app/shared";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { Can } from "@/features/auth/can";
import { PERM } from "@/lib/permissions";
import {
  COMPONENT_CATEGORY_LABEL,
  COMPONENT_CONDITION_LABEL,
  COMPONENT_STATUS_LABEL,
  STOCK_TXN_TYPE_LABEL,
} from "@/lib/labels";
import { formatDateTime, formatVnd } from "@/lib/utils";
import {
  useComponent,
  useScrapComponent,
} from "@/features/inventory/hooks";

export default function ComponentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, isError } = useComponent(params.id);
  const scrapMut = useScrapComponent(params.id);
  const [scrapOpen, setScrapOpen] = React.useState(false);

  if (isLoading) {
    return (
      <div>
        <Skeleton className="mb-4 h-10 w-64" />
        <Skeleton className="h-72" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Không tải được linh kiện.
      </div>
    );
  }

  const canScrap = data.status === ComponentStatus.IN_STOCK;

  const onScrap = async () => {
    try {
      await scrapMut.mutateAsync();
      toast.success("Đã thanh lý linh kiện");
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error?.message ?? "Thanh lý thất bại",
      );
    }
  };

  return (
    <div>
      <PageHeader
        title={`Linh kiện ${data.code}`}
        description={COMPONENT_CATEGORY_LABEL[data.categoryCode]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/components")}>
              Quay lại
            </Button>
            <Can permission={PERM.COMPONENT_SCRAP}>
              <Button
                variant="destructive"
                disabled={!canScrap}
                onClick={() => setScrapOpen(true)}
              >
                Thanh lý
              </Button>
            </Can>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Thông tin</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Trạng thái">
              <StatusBadge
                status={data.status}
                label={COMPONENT_STATUS_LABEL[data.status]}
              />
            </Row>
            <Row label="Serial">{data.serial ?? "-"}</Row>
            <Row label="Model">{data.model ?? "-"}</Row>
            <Row label="Tình trạng">
              {data.condition
                ? COMPONENT_CONDITION_LABEL[data.condition]
                : "-"}
            </Row>
            <Row label="Giá vốn">{formatVnd(data.costPrice ?? 0)}</Row>
            <Row label="Vị trí">{data.location ?? "-"}</Row>
            <Row label="Máy nguồn">
              {data.sourceMachine ? (
                <Link
                  className="text-primary underline"
                  href={`/machines/${data.sourceMachine.id}`}
                >
                  {data.sourceMachine.code}
                </Link>
              ) : (
                "-"
              )}
            </Row>
            <Row label="Máy thành phẩm">
              {data.currentFinishedPc ? (
                <Link
                  className="text-primary underline"
                  href={`/finished-pcs/${data.currentFinishedPc.id}`}
                >
                  {data.currentFinishedPc.code}
                </Link>
              ) : (
                "-"
              )}
            </Row>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Lịch sử lắp ráp</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.history && data.history.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Máy thành phẩm</TableHead>
                    <TableHead>Lắp lúc</TableHead>
                    <TableHead>Tháo lúc</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.history.map((h, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Link
                          className="text-primary underline"
                          href={`/finished-pcs/${h.finishedPcId}`}
                        >
                          {h.finishedPcCode}
                        </Link>
                      </TableCell>
                      <TableCell>{formatDateTime(h.installedAt)}</TableCell>
                      <TableCell>
                        {h.removedAt ? formatDateTime(h.removedAt) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="p-6 text-sm text-muted-foreground">
                Chưa có lịch sử.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Lịch sử kho</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.stockTransactions && data.stockTransactions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Thời gian</TableHead>
                    <TableHead>Loại</TableHead>
                    <TableHead>Lý do</TableHead>
                    <TableHead>Tham chiếu</TableHead>
                    <TableHead>Người tạo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.stockTransactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{formatDateTime(t.createdAt)}</TableCell>
                      <TableCell>{STOCK_TXN_TYPE_LABEL[t.type]}</TableCell>
                      <TableCell>{t.reason ?? "-"}</TableCell>
                      <TableCell>{t.reference ?? "-"}</TableCell>
                      <TableCell>
                        {t.createdBy?.fullName ?? "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="p-6 text-sm text-muted-foreground">
                Chưa có giao dịch.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={scrapOpen}
        onOpenChange={setScrapOpen}
        title="Thanh lý linh kiện?"
        description="Linh kiện sẽ chuyển sang trạng thái thanh lý và không thể sử dụng."
        confirmText="Thanh lý"
        destructive
        loading={scrapMut.isPending}
        onConfirm={onScrap}
      />
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}
