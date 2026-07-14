"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { AssemblyStatus } from "@app/shared";
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
  ASSEMBLY_STATUS_LABEL,
  COMPONENT_CATEGORY_LABEL,
  FINISHED_PC_STATUS_LABEL,
} from "@/lib/labels";
import { formatVnd, formatDateTime } from "@/lib/utils";
import {
  useAssembly,
  useCancelAssembly,
  useCompleteAssembly,
  useStartAssembly,
} from "@/features/assembly/hooks";

function AssemblyDetailBody() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const router = useRouter();
  const { data, isLoading, isError } = useAssembly(id);
  const startMut = useStartAssembly();
  const completeMut = useCompleteAssembly();
  const cancelMut = useCancelAssembly();
  const [startOpen, setStartOpen] = React.useState(false);
  const [completeOpen, setCompleteOpen] = React.useState(false);
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
        Không tải được phiếu lắp ráp.
      </div>
    );
  }

  const isDraft = data.status === AssemblyStatus.DRAFT;
  const isInProgress = data.status === AssemblyStatus.IN_PROGRESS;
  const canEdit = isDraft || isInProgress;

  const finishedPc = data.finishedPcs?.[0];

  const handleStart = async () => {
    try {
      await startMut.mutateAsync(data.id);
      toast.success("Đã bắt đầu lắp ráp");
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Bắt đầu thất bại");
    }
  };
  const handleComplete = async () => {
    try {
      await completeMut.mutateAsync(data.id);
      toast.success("Đã hoàn tất, tạo máy thành phẩm");
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Hoàn tất thất bại");
    }
  };
  const handleCancel = async () => {
    try {
      await cancelMut.mutateAsync(data.id);
      toast.success("Đã hủy phiếu");
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Hủy thất bại");
    }
  };

  return (
    <div>
      <PageHeader
        title={`Phiếu lắp ráp ${data.code}`}
        description={`Tạo lúc ${formatDateTime(data.createdAt)}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/assemblies")}>
              Quay lại
            </Button>
            {isDraft && (
              <>
                <Can permission={PERM.ASSEMBLY_CANCEL}>
                  <Button variant="destructive" onClick={() => setCancelOpen(true)}>
                    Hủy
                  </Button>
                </Can>
                <Can permission={PERM.ASSEMBLY_UPDATE}>
                  <Button onClick={() => setStartOpen(true)}>Bắt đầu lắp</Button>
                </Can>
              </>
            )}
            {isInProgress && (
              <>
                <Can permission={PERM.ASSEMBLY_CANCEL}>
                  <Button variant="destructive" onClick={() => setCancelOpen(true)}>
                    Hủy
                  </Button>
                </Can>
                <Can permission={PERM.ASSEMBLY_COMPLETE}>
                  <Button onClick={() => setCompleteOpen(true)}>Hoàn tất</Button>
                </Can>
              </>
            )}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Thông tin</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Trạng thái</span>
              <StatusBadge
                status={data.status}
                label={ASSEMBLY_STATUS_LABEL[data.status]}
              />
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Chi phí sửa</span>
              <span>{formatVnd(data.repairCost)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Chi phí vệ sinh</span>
              <span>{formatVnd(data.cleaningCost)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Chi phí lắp ráp</span>
              <span>{formatVnd(data.assemblyCost)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Giá linh kiện</span>
              <span>{formatVnd(data.componentsTotal)}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="font-semibold">Tổng giá thành</span>
              <span className="font-semibold">{formatVnd(data.totalCost)}</span>
            </div>
            {data.startedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bắt đầu</span>
                <span>{formatDateTime(data.startedAt)}</span>
              </div>
            )}
            {data.completedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hoàn tất</span>
                <span>{formatDateTime(data.completedAt)}</span>
              </div>
            )}
            {data.notes && (
              <div>
                <span className="text-muted-foreground">Ghi chú</span>
                <p className="mt-1 whitespace-pre-wrap">{data.notes}</p>
              </div>
            )}
            {finishedPc && (
              <div className="border-t pt-2">
                <span className="text-muted-foreground">Máy tính</span>
                <div className="mt-1 flex items-center justify-between">
                  <Link
                    href={`/finished-pcs/detail?id=${finishedPc.id}`}
                    className="font-medium underline"
                  >
                    {finishedPc.code}
                  </Link>
                  <StatusBadge
                    status={finishedPc.status}
                    label={FINISHED_PC_STATUS_LABEL[finishedPc.status]}
                  />
                </div>
              </div>
            )}
            {canEdit && !finishedPc && (
              <div className="border-t pt-2">
                <span className="text-muted-foreground">Máy tính dự kiến</span>
                <div className="mt-1 font-medium">
                  {formatVnd(data.draftPcPreview.costPrice)}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Linh kiện</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Serial</TableHead>
                  <TableHead className="text-right">Giá vốn</TableHead>
                  <TableHead>Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.components.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.component.code}</TableCell>
                    <TableCell>
                      {COMPONENT_CATEGORY_LABEL[c.component.categoryCode] ?? c.role}
                    </TableCell>
                    <TableCell>{c.component.model ?? "-"}</TableCell>
                    <TableCell>{c.component.serial ?? "-"}</TableCell>
                    <TableCell className="text-right">
                      {formatVnd(c.unitCost)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={c.component.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={startOpen}
        onOpenChange={setStartOpen}
        title="Bắt đầu lắp ráp?"
        description="Phiếu sẽ chuyển sang trạng thái Đang lắp."
        confirmText="Bắt đầu"
        loading={startMut.isPending}
        onConfirm={handleStart}
      />
      <ConfirmDialog
        open={completeOpen}
        onOpenChange={setCompleteOpen}
        title="Hoàn tất phiếu lắp ráp?"
        description="Hệ thống sẽ tạo máy thành phẩm, các linh kiện sẽ chuyển sang trạng thái ASSEMBLED. Thao tác này không thể hoàn tác."
        confirmText="Hoàn tất"
        loading={completeMut.isPending}
        onConfirm={handleComplete}
      />
      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Hủy phiếu lắp ráp?"
        description="Các linh kiện đang giữ sẽ được trả về kho (IN_STOCK)."
        confirmText="Hủy phiếu"
        destructive
        loading={cancelMut.isPending}
        onConfirm={handleCancel}
      />
    </div>
  );
}

export default function AssemblyDetailPage() {
  return (
    <Suspense fallback={<div>Đang tải...</div>}>
      <AssemblyDetailBody />
    </Suspense>
  );
}
