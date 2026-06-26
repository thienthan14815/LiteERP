"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { FinishedPcStatus } from "@app/shared";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  FINISHED_PC_STATUS_LABEL,
} from "@/lib/labels";
import { formatVnd, formatDateTime } from "@/lib/utils";
import {
  useFinishedPc,
  useScrapFinishedPc,
  useTransitionFinishedPc,
  useUpdateFinishedPc,
} from "@/features/finished-pc/hooks";

export default function FinishedPcDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, isError } = useFinishedPc(params.id);
  const updateMut = useUpdateFinishedPc(params.id);
  const transitionMut = useTransitionFinishedPc(params.id);
  const scrapMut = useScrapFinishedPc(params.id);
  const [scrapOpen, setScrapOpen] = React.useState(false);
  const [suggestedPrice, setSuggestedPrice] = React.useState<number | "">("");
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    if (data) {
      setSuggestedPrice(Number(data.suggestedPrice ?? 0));
      setNotes(data.notes ?? "");
    }
  }, [data]);

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
        Không tải được máy thành phẩm.
      </div>
    );
  }

  const saveMeta = async () => {
    try {
      await updateMut.mutateAsync({
        suggestedPrice: Number(suggestedPrice || 0),
        notes,
      });
      toast.success("Đã lưu");
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Lưu thất bại");
    }
  };

  const transition = async (to: FinishedPcStatus) => {
    try {
      await transitionMut.mutateAsync(to);
      toast.success("Đã cập nhật trạng thái");
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Chuyển trạng thái thất bại");
    }
  };

  const handleScrap = async () => {
    try {
      await scrapMut.mutateAsync();
      toast.success("Đã thanh lý");
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Thanh lý thất bại");
    }
  };

  return (
    <div>
      <PageHeader
        title={`Máy ${data.code}`}
        description={`Tạo lúc ${formatDateTime(data.createdAt)}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/finished-pcs")}>
              Quay lại
            </Button>
            {data.status === FinishedPcStatus.READY_FOR_SALE && (
              <Can permission={PERM.FINISHED_PC_UPDATE}>
                <Button variant="outline" onClick={() => transition(FinishedPcStatus.TESTING)}>
                  Chuyển sang Test
                </Button>
              </Can>
            )}
            {data.status === FinishedPcStatus.TESTING && (
              <Can permission={PERM.FINISHED_PC_UPDATE}>
                <Button onClick={() => transition(FinishedPcStatus.READY_FOR_SALE)}>
                  Sẵn sàng bán
                </Button>
              </Can>
            )}
            {data.status === FinishedPcStatus.ASSEMBLING && (
              <Can permission={PERM.FINISHED_PC_UPDATE}>
                <Button onClick={() => transition(FinishedPcStatus.TESTING)}>
                  Chuyển sang Test
                </Button>
              </Can>
            )}
            {data.status !== FinishedPcStatus.SOLD &&
              data.status !== FinishedPcStatus.SCRAPPED && (
                <Can permission={PERM.FINISHED_PC_UPDATE}>
                  <Button variant="destructive" onClick={() => setScrapOpen(true)}>
                    Thanh lý
                  </Button>
                </Can>
              )}
          </div>
        }
      />

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Trạng thái</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Hiện tại</span>
              <StatusBadge
                status={data.status}
                label={FINISHED_PC_STATUS_LABEL[data.status]}
              />
            </div>
            {data.assemblyOrder && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phiếu lắp</span>
                <Link href={`/assemblies/${data.assemblyOrder.id}`} className="underline">
                  {data.assemblyOrder.code}
                </Link>
              </div>
            )}
            {data.readyAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sẵn sàng</span>
                <span>{formatDateTime(data.readyAt)}</span>
              </div>
            )}
            {data.soldAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Đã bán</span>
                <span>{formatDateTime(data.soldAt)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Giá trị</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Giá vốn</span>
              <span className="font-medium">{formatVnd(data.costPrice)}</span>
            </div>
            <div>
              <Label className="text-muted-foreground">Giá đề xuất</Label>
              <Input
                type="number"
                min={0}
                value={suggestedPrice}
                onChange={(e) =>
                  setSuggestedPrice(e.target.value === "" ? "" : Number(e.target.value))
                }
                disabled={
                  data.status === FinishedPcStatus.SOLD ||
                  data.status === FinishedPcStatus.SCRAPPED
                }
              />
            </div>
            {data.soldPrice != null && (
              <div className="flex justify-between border-t pt-2">
                <span className="text-muted-foreground">Giá bán</span>
                <span className="font-semibold">{formatVnd(data.soldPrice)}</span>
              </div>
            )}
            <Can permission={PERM.FINISHED_PC_UPDATE}>
              <Button
                size="sm"
                onClick={saveMeta}
                disabled={updateMut.isPending}
              >
                {updateMut.isPending ? "Đang lưu..." : "Lưu"}
              </Button>
            </Can>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Ghi chú</CardTitle></CardHeader>
          <CardContent>
            <Textarea
              rows={5}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={
                data.status === FinishedPcStatus.SOLD ||
                data.status === FinishedPcStatus.SCRAPPED
              }
            />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="config" className="w-full">
        <TabsList>
          <TabsTrigger value="config">Cấu hình</TabsTrigger>
          <TabsTrigger value="history">Lịch sử linh kiện</TabsTrigger>
          <TabsTrigger value="repair">Lịch sử sửa chữa</TabsTrigger>
        </TabsList>
        <TabsContent value="config">
          <Card>
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
                  {data.currentComponents.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Chưa có linh kiện
                      </TableCell>
                    </TableRow>
                  )}
                  {data.currentComponents.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        <Link href={`/components/${c.id}`} className="underline">{c.code}</Link>
                      </TableCell>
                      <TableCell>{COMPONENT_CATEGORY_LABEL[c.categoryCode]}</TableCell>
                      <TableCell>{c.model ?? "-"}</TableCell>
                      <TableCell>{c.serial ?? "-"}</TableCell>
                      <TableCell className="text-right">{formatVnd(c.costPrice)}</TableCell>
                      <TableCell><StatusBadge status={c.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="history">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã LK</TableHead>
                    <TableHead>Loại</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Serial</TableHead>
                    <TableHead>Lắp lúc</TableHead>
                    <TableHead>Tháo lúc</TableHead>
                    <TableHead>Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.componentHistory.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        Chưa có lịch sử
                      </TableCell>
                    </TableRow>
                  )}
                  {data.componentHistory.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="font-medium">
                        <Link href={`/components/${h.componentId}`} className="underline">
                          {h.componentCode}
                        </Link>
                      </TableCell>
                      <TableCell>{COMPONENT_CATEGORY_LABEL[h.categoryCode]}</TableCell>
                      <TableCell>{h.model ?? "-"}</TableCell>
                      <TableCell>{h.serial ?? "-"}</TableCell>
                      <TableCell>{formatDateTime(h.installedAt)}</TableCell>
                      <TableCell>
                        {h.removedAt ? formatDateTime(h.removedAt) : "-"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          status={h.isCurrent ? "ACTIVE" : "REMOVED"}
                          label={h.isCurrent ? "Đang dùng" : "Đã tháo"}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="repair">
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Chưa có lịch sử sửa chữa. Tính năng sẽ được bổ sung ở phase bảo hành.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={scrapOpen}
        onOpenChange={setScrapOpen}
        title="Thanh lý máy thành phẩm?"
        description="Tất cả linh kiện bên trong cũng sẽ chuyển sang SCRAPPED. Thao tác không thể hoàn tác."
        confirmText="Thanh lý"
        destructive
        loading={scrapMut.isPending}
        onConfirm={handleScrap}
      />
    </div>
  );
}
