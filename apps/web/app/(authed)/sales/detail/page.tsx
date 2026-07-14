"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { SalesItemType, SalesOrderStatus } from "@app/shared";
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
  SALES_ITEM_TYPE_LABEL,
  SALES_ORDER_STATUS_LABEL,
} from "@/lib/labels";
import { formatVnd, formatDateTime } from "@/lib/utils";
import {
  useCancelSale,
  useConfirmSale,
  useSale,
} from "@/features/sale/hooks";

function SaleDetailBody() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const router = useRouter();
  const { data, isLoading, isError } = useSale(id);
  const confirmMut = useConfirmSale();
  const cancelMut = useCancelSale();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);

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
        Không tải được đơn bán hàng.
      </div>
    );
  }

  const isDraft = data.status === SalesOrderStatus.DRAFT;
  const isConfirmed = data.status === SalesOrderStatus.CONFIRMED;

  const handleConfirm = async () => {
    try {
      await confirmMut.mutateAsync(data.id);
      toast.success("Đã xác nhận đơn bán");
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Xác nhận thất bại");
    }
  };
  const handleCancel = async () => {
    try {
      await cancelMut.mutateAsync(data.id);
      toast.success("Đã hủy đơn bán");
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Hủy thất bại");
    }
  };

  return (
    <div>
      <PageHeader
        title={data.orderName || `Đơn bán ${data.code}`}
        description={`${data.code} · Tạo lúc ${formatDateTime(data.createdAt)}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/sales")}>
              Quay lại
            </Button>
            {isDraft && (
              <Can permission={PERM.SALE_CREATE}>
                <Button onClick={() => setConfirmOpen(true)}>Xác nhận</Button>
              </Can>
            )}
            {isConfirmed && (
              <Can permission={PERM.SALE_CANCEL}>
                <Button variant="destructive" onClick={() => setCancelOpen(true)}>
                  Hủy đơn
                </Button>
              </Can>
            )}
          </div>
        }
      />

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Người mua</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="font-medium">{data.customer?.name ?? "-"}</div>
            <div className="text-muted-foreground">{data.customer?.phone ?? "-"}</div>
            <div className="text-muted-foreground">{data.customer?.email ?? "-"}</div>
            <div className="text-muted-foreground">{data.customer?.code ?? ""}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Kênh bán</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Người bán</span>
              <span>{data.sellerName ?? "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nền tảng</span>
              <span>{data.platform ?? "-"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">URL bán hàng</span>
              <div className="mt-1 break-all">
                {data.salesUrl ? (
                  <a
                    href={data.salesUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {data.salesUrl}
                  </a>
                ) : "-"}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Trạng thái</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Hiện tại</span>
              <StatusBadge
                status={data.status}
                label={SALES_ORDER_STATUS_LABEL[data.status]}
              />
            </div>
            {data.confirmedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Xác nhận</span>
                <span>{formatDateTime(data.confirmedAt)}</span>
              </div>
            )}
            {data.cancelledAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hủy</span>
                <span>{formatDateTime(data.cancelledAt)}</span>
              </div>
            )}
            {data.notes && (
              <div>
                <span className="text-muted-foreground">Ghi chú</span>
                <p className="mt-1 whitespace-pre-wrap">{data.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Tài chính</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Doanh thu</span>
              <span className="font-medium">{formatVnd(data.revenue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Giá vốn{isDraft ? " (chưa khoá)" : ""}
              </span>
              <span>{formatVnd(data.cost)}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="font-semibold">Lợi nhuận</span>
              <span className="font-semibold">
                {isConfirmed ? formatVnd(data.profit) : "-"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Mặt hàng</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loại</TableHead>
                <TableHead>Mã / Mặt hàng</TableHead>
                <TableHead>Chi tiết</TableHead>
                <TableHead className="text-right">SL</TableHead>
                <TableHead className="text-right">Đơn giá</TableHead>
                <TableHead className="text-right">Giá vốn</TableHead>
                <TableHead className="text-right">Thành tiền</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell>{SALES_ITEM_TYPE_LABEL[it.itemType]}</TableCell>
                  <TableCell className="font-medium">
                    {it.itemType === SalesItemType.FINISHED_PC && it.finishedPc ? (
                      <Link href={`/finished-pcs/detail?id=${it.finishedPc.id}`} className="underline">
                        {it.finishedPc.code}
                      </Link>
                    ) : it.component ? (
                      <Link href={`/components/detail?id=${it.component.id}`} className="underline">
                        {it.component.code}
                      </Link>
                    ) : "-"}
                  </TableCell>
                  <TableCell>
                    {it.component
                      ? `${COMPONENT_CATEGORY_LABEL[it.component.category.code]} · ${it.component.model ?? "-"} · ${it.component.serialNumber ?? "-"}`
                      : it.finishedPc
                        ? `Máy tính`
                        : "-"}
                  </TableCell>
                  <TableCell className="text-right">{it.quantity}</TableCell>
                  <TableCell className="text-right">{formatVnd(it.unitPrice)}</TableCell>
                  <TableCell className="text-right">{formatVnd(it.unitCost)}</TableCell>
                  <TableCell className="text-right">{formatVnd(it.totalPrice)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Xác nhận đơn bán?"
        description="Hệ thống sẽ ghi nhận giá vốn (frozen), xuất kho linh kiện / máy thành phẩm, và cập nhật trạng thái SOLD."
        confirmText="Xác nhận"
        loading={confirmMut.isPending}
        onConfirm={handleConfirm}
      />
      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Hủy đơn bán đã xác nhận?"
        description="Các linh kiện sẽ được hoàn lại kho và máy thành phẩm chuyển về READY_FOR_SALE. Chỉ cho phép trong vòng 24h từ lúc xác nhận."
        confirmText="Hủy đơn"
        destructive
        loading={cancelMut.isPending}
        onConfirm={handleCancel}
      />
    </div>
  );
}

export default function SaleDetailPage() {
  return (
    <Suspense fallback={<div>Đang tải...</div>}>
      <SaleDetailBody />
    </Suspense>
  );
}
