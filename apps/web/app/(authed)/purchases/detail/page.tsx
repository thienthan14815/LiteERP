"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { PurchaseOrderStatus } from "@app/shared";
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
  PURCHASE_ITEM_TYPE_LABEL,
  PURCHASE_ORDER_STATUS_LABEL,
} from "@/lib/labels";
import { formatVnd, formatDateTime } from "@/lib/utils";
import {
  useCancelPurchase,
  useConfirmPurchase,
  useDeletePurchase,
  useDeletePurchaseItem,
  usePurchase,
} from "@/features/purchase/hooks";
import { EditPurchaseItemDialog } from "@/features/purchase/edit-item-dialog";
import type { PurchaseItem } from "@/features/purchase/api";
import { AttachmentUploader } from "@/components/forms/attachment-uploader";

function PurchaseDetailBody() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const router = useRouter();
  const { data, isLoading, isError } = usePurchase(id);
  const confirmMut = useConfirmPurchase();
  const cancelMut = useCancelPurchase();
  const deleteMut = useDeletePurchase();
  const deleteItemMut = useDeletePurchaseItem(id ?? "");
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [editItem, setEditItem] = React.useState<PurchaseItem | null>(null);
  const [deleteItemId, setDeleteItemId] = React.useState<string | null>(null);

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
        Không tải được phiếu mua.
      </div>
    );
  }

  const isDraft = data.status === PurchaseOrderStatus.DRAFT;
  const isConfirmed = data.status === PurchaseOrderStatus.CONFIRMED;
  const isCancelled = data.status === PurchaseOrderStatus.CANCELLED;

  const handleConfirm = async () => {
    try {
      await confirmMut.mutateAsync(data.id);
      toast.success("Đã xác nhận phiếu mua");
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error?.message ?? "Xác nhận thất bại",
      );
    }
  };

  const handleCancel = async () => {
    try {
      await cancelMut.mutateAsync(data.id);
      toast.success("Đã hủy phiếu mua");
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error?.message ?? "Hủy thất bại",
      );
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMut.mutateAsync(data.id);
      toast.success("Đã xóa phiếu mua");
      router.push("/purchases");
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error?.message ?? "Xóa phiếu thất bại",
      );
    }
  };

  const handleDeleteItem = async () => {
    if (!deleteItemId) return;
    try {
      await deleteItemMut.mutateAsync(deleteItemId);
      toast.success("Đã xóa mục");
      setDeleteItemId(null);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error?.message ?? "Xóa mục thất bại",
      );
    }
  };

  return (
    <div>
      <PageHeader
        title={`Phiếu mua ${data.code}`}
        description={`Tạo lúc ${formatDateTime(data.createdAt)}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/purchases")}>
              Quay lại
            </Button>
            {(isDraft || isConfirmed) && (
              <Can permission={PERM.PURCHASE_CANCEL}>
                <Button
                  variant="destructive"
                  onClick={() => setCancelOpen(true)}
                >
                  Hủy phiếu
                </Button>
              </Can>
            )}
            {(isDraft || isCancelled) && (
              <Can permission={PERM.PURCHASE_CANCEL}>
                <Button
                  variant="destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  Xóa phiếu
                </Button>
              </Can>
            )}
            {isDraft && (
              <Can permission={PERM.PURCHASE_CONFIRM}>
                <Button onClick={() => setConfirmOpen(true)}>
                  Xác nhận
                </Button>
              </Can>
            )}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Thông tin</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Trạng thái</span>
              <StatusBadge
                status={data.status}
                label={PURCHASE_ORDER_STATUS_LABEL[data.status]}
              />
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nhà cung cấp</span>
              <span>{data.supplier?.name ?? data.supplierName ?? "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tổng tiền</span>
              <span className="font-semibold">
                {formatVnd(data.totalAmount)}
              </span>
            </div>
            {data.confirmedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Xác nhận lúc</span>
                <span>{formatDateTime(data.confirmedAt)}</span>
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

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Danh sách mục</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loại</TableHead>
                  <TableHead>Mô tả</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Serial</TableHead>
                  <TableHead className="text-right">SL</TableHead>
                  <TableHead className="text-right">Đơn giá</TableHead>
                  <TableHead className="text-right">Thành tiền</TableHead>
                  {isDraft && <TableHead className="text-right">Thao tác</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell>
                      {PURCHASE_ITEM_TYPE_LABEL[it.itemType]}
                    </TableCell>
                    <TableCell>{it.description}</TableCell>
                    <TableCell>{it.model ?? "-"}</TableCell>
                    <TableCell>{it.serial ?? "-"}</TableCell>
                    <TableCell className="text-right">{it.quantity}</TableCell>
                    <TableCell className="text-right">
                      {formatVnd(it.unitPrice)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatVnd(it.totalPrice)}
                    </TableCell>
                    {isDraft && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Can permission={PERM.PURCHASE_UPDATE}>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditItem(it)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteItemId(it.id)}
                              disabled={data.items.length <= 1}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </Can>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Tệp đính kèm</CardTitle>
        </CardHeader>
        <CardContent>
          <AttachmentUploader relatedType="PURCHASE_ORDER" relatedId={data.id} />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Xác nhận phiếu mua?"
        description="Sau khi xác nhận, hệ thống sẽ sinh máy/linh kiện và nhập kho. Thao tác này không thể hoàn tác."
        confirmText="Xác nhận"
        loading={confirmMut.isPending}
        onConfirm={handleConfirm}
      />

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Hủy phiếu mua?"
        description={
          isConfirmed
            ? "Phiếu đã xác nhận: hệ thống sẽ HOÀN TÁC nhập kho — xóa các máy/linh kiện đã sinh từ phiếu này cùng lịch sử kho của chúng. Chỉ hủy được khi chúng chưa được dùng (tháo máy, lắp ráp, bán, bảo hành)."
            : "Phiếu sẽ chuyển sang trạng thái đã hủy và máy/linh kiện đã sinh từ phiếu bị xóa."
        }
        confirmText="Hủy phiếu"
        destructive
        loading={cancelMut.isPending}
        onConfirm={handleCancel}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Xóa hẳn phiếu mua?"
        description="Phiếu, các mục, máy/linh kiện đã sinh và tệp đính kèm của phiếu sẽ bị xóa vĩnh viễn. Không thể hoàn tác."
        confirmText="Xóa phiếu"
        destructive
        loading={deleteMut.isPending}
        onConfirm={handleDelete}
      />

      <EditPurchaseItemDialog
        orderId={data.id}
        item={editItem}
        open={!!editItem}
        onOpenChange={(open) => !open && setEditItem(null)}
      />

      <ConfirmDialog
        open={!!deleteItemId}
        onOpenChange={(open) => !open && setDeleteItemId(null)}
        title="Xóa mục này?"
        description="Máy/linh kiện đã sinh cho mục này (khi tạo phiếu) sẽ bị xóa theo."
        confirmText="Xóa"
        destructive
        loading={deleteItemMut.isPending}
        onConfirm={handleDeleteItem}
      />
    </div>
  );
}

export default function PurchaseDetailPage() {
  return (
    <Suspense fallback={<div>Đang tải...</div>}>
      <PurchaseDetailBody />
    </Suspense>
  );
}
