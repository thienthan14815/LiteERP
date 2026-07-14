"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { ComponentCondition, ComponentStatus } from "@app/shared";
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
  useDeleteComponent,
  useScrapComponent,
  useUpdateComponent,
} from "@/features/inventory/hooks";
import { AttachmentUploader } from "@/components/forms/attachment-uploader";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

function ComponentDetailBody() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const router = useRouter();
  const { data, isLoading, isError } = useComponent(id);
  const scrapMut = useScrapComponent(id);
  const updateMut = useUpdateComponent(id);
  const deleteMut = useDeleteComponent();
  const [scrapOpen, setScrapOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editModel, setEditModel] = React.useState("");
  const [editSerial, setEditSerial] = React.useState("");
  const [editLocation, setEditLocation] = React.useState("");
  const [editCondition, setEditCondition] = React.useState<string>("GOOD");
  const [editCost, setEditCost] = React.useState<number | "">("");
  const [editNotes, setEditNotes] = React.useState("");

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
            <Can permission={PERM.COMPONENT_UPDATE}>
              <Button
                variant="outline"
                onClick={() => {
                  setEditModel(data.model ?? "");
                  setEditSerial(data.serial ?? "");
                  setEditLocation(data.location ?? "");
                  setEditCondition(data.condition ?? "GOOD");
                  setEditCost(Number(data.costPrice ?? 0));
                  setEditNotes((data as any).notes ?? "");
                  setEditOpen(true);
                }}
              >
                <Pencil className="mr-1 h-4 w-4" /> Sửa
              </Button>
            </Can>
            <Can permission={PERM.COMPONENT_SCRAP}>
              <Button
                variant="destructive"
                disabled={!canScrap}
                onClick={() => setScrapOpen(true)}
              >
                Thanh lý
              </Button>
            </Can>
            <Can permission={PERM.COMPONENT_SCRAP}>
              <Button
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="mr-1 h-4 w-4" /> Xóa
              </Button>
            </Can>
          </div>
        }
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sửa linh kiện {data.code}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="c-model">Model</Label>
              <Input
                id="c-model"
                value={editModel}
                onChange={(e) => setEditModel(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="c-serial">Serial</Label>
              <Input
                id="c-serial"
                value={editSerial}
                onChange={(e) => setEditSerial(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="c-cond">Tình trạng</Label>
              <Select value={editCondition} onValueChange={setEditCondition}>
                <SelectTrigger id="c-cond">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(ComponentCondition).map((c) => (
                    <SelectItem key={c} value={c}>
                      {COMPONENT_CONDITION_LABEL[c] ?? c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="c-cost">Giá vốn (TWD)</Label>
              <Input
                id="c-cost"
                type="number"
                min={0}
                value={editCost}
                onChange={(e) =>
                  setEditCost(e.target.value === "" ? "" : Number(e.target.value))
                }
              />
            </div>
            <div>
              <Label htmlFor="c-loc">Vị trí</Label>
              <Input
                id="c-loc"
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="c-notes">Ghi chú</Label>
              <Textarea
                id="c-notes"
                rows={3}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={updateMut.isPending}
            >
              Hủy
            </Button>
            <Button
              onClick={async () => {
                try {
                  await updateMut.mutateAsync({
                    model: editModel,
                    serialNumber: editSerial,
                    location: editLocation,
                    condition: editCondition as ComponentCondition,
                    costPrice: Number(editCost || 0),
                    notes: editNotes,
                  });
                  toast.success("Đã lưu");
                  setEditOpen(false);
                } catch (err: any) {
                  toast.error(
                    err?.response?.data?.error?.message ?? "Không lưu được",
                  );
                }
              }}
              disabled={updateMut.isPending}
            >
              {updateMut.isPending ? "Đang lưu..." : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Xóa linh kiện ${data.code}?`}
        description="Linh kiện, lịch sử kho và hình ảnh của nó sẽ bị xóa vĩnh viễn. Không xóa được nếu đang nằm trong máy / lắp ráp / đã bán / bảo hành."
        confirmText="Xóa"
        destructive
        loading={deleteMut.isPending}
        onConfirm={async () => {
          try {
            await deleteMut.mutateAsync(data.id);
            toast.success("Đã xóa linh kiện");
            router.push("/components");
          } catch (err: any) {
            toast.error(
              err?.response?.data?.error?.message ?? "Xóa thất bại",
            );
          }
        }}
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
                  href={`/machines/detail?id=${data.sourceMachine.id}`}
                >
                  {data.sourceMachine.code}
                </Link>
              ) : (
                "-"
              )}
            </Row>
            <Row label="Máy tính">
              {data.currentFinishedPc ? (
                <Link
                  className="text-primary underline"
                  href={`/finished-pcs/detail?id=${data.currentFinishedPc.id}`}
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
                    <TableHead>Máy tính</TableHead>
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
                          href={`/finished-pcs/detail?id=${h.finishedPcId}`}
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
            <CardTitle>Hình ảnh sản phẩm</CardTitle>
          </CardHeader>
          <CardContent>
            <AttachmentUploader relatedType="Component" relatedId={data.id} />
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

export default function ComponentDetailPage() {
  return (
    <Suspense fallback={<div>Đang tải...</div>}>
      <ComponentDetailBody />
    </Suspense>
  );
}
