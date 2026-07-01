"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronsUpDown, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { StatusBadge } from "@/components/tables/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { AttachmentUploader } from "@/components/forms/attachment-uploader";
import { WarrantyStatus } from "@app/shared";
import {
  searchInStockComponents,
  type SoldComponentOption,
  type WarrantyDetail,
} from "@/features/warranty/api";
import {
  useCancelWarranty,
  useReplaceWarrantyComponent,
  useTransitionWarranty,
  useWarranty,
} from "@/features/warranty/hooks";
import { WARRANTY_STATUS_LABEL } from "@/lib/labels";
import { formatDate, formatDateTime } from "@/lib/utils";

const ALLOWED: Record<WarrantyStatus, WarrantyStatus[]> = {
  RECEIVED: [WarrantyStatus.INSPECTING],
  INSPECTING: [WarrantyStatus.REPAIRING, WarrantyStatus.REPLACED, WarrantyStatus.REJECTED],
  REPAIRING: [WarrantyStatus.REPLACED, WarrantyStatus.COMPLETED, WarrantyStatus.REJECTED],
  REPLACED: [WarrantyStatus.COMPLETED],
  COMPLETED: [],
  REJECTED: [],
};

export default function WarrantyDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const { data, isLoading } = useWarranty(id);
  const transitionMut = useTransitionWarranty(id ?? "");
  const cancelMut = useCancelWarranty(id ?? "");
  const [pendingTransition, setPendingTransition] = React.useState<WarrantyStatus | null>(null);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [replaceOpen, setReplaceOpen] = React.useState(false);

  if (isLoading || !data) {
    return (
      <div>
        <Skeleton className="mb-4 h-10 w-1/2" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const w = data;
  const allowedTransitions = ALLOWED[w.status];

  return (
    <div>
      <PageHeader
        title={`Đơn bảo hành ${w.code}`}
        description={`Trạng thái: ${WARRANTY_STATUS_LABEL[w.status]}`}
        actions={
          <Button variant="outline" onClick={() => router.back()}>Quay lại</Button>
        }
      />

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Tổng quan</TabsTrigger>
          <TabsTrigger value="parts">Linh kiện thay thế</TabsTrigger>
          <TabsTrigger value="actions">Hành động</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardContent className="grid gap-4 p-4 md:grid-cols-2">
              <Info label="Khách hàng" value={w.customer ? `${w.customer.name}${w.customer.phone ? ` · ${w.customer.phone}` : ""}` : "-"} />
              <Info
                label="Máy / linh kiện"
                value={
                  w.finishedPc ? (
                    <Link href={`/finished-pcs/${w.finishedPc.id}`} className="font-medium hover:underline">
                      {w.finishedPc.code}
                    </Link>
                  ) : w.relatedComponent ? (
                    <span className="font-medium">{w.relatedComponent.code}</span>
                  ) : (
                    <span>-</span>
                  )
                }
              />
              <Info label="Mô tả lỗi" value={w.description} />
              <Info label="Ngày nhận" value={formatDate(w.receivedAt)} />
              <Info label="Trạng thái hiện tại" value={<StatusBadge status={w.status} label={WARRANTY_STATUS_LABEL[w.status]} />} />
              <Info label="Hoàn thành" value={w.completedAt ? formatDateTime(w.completedAt) : "-"} />
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardContent className="p-4">
              <h3 className="mb-3 text-sm font-semibold">Lịch sử trạng thái</h3>
              {!w.timeline || w.timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">Chưa có sự kiện</p>
              ) : (
                <ul className="space-y-2">
                  {w.timeline.map((t) => (
                    <li key={t.id} className="flex items-start gap-3 text-sm">
                      <span className="w-40 shrink-0 text-muted-foreground">{formatDateTime(t.createdAt)}</span>
                      <span className="font-medium">{t.action}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="parts">
          <Card>
            <CardContent className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Linh kiện đã thay</h3>
                {w.finishedPc && w.status !== WarrantyStatus.COMPLETED && w.status !== WarrantyStatus.REJECTED && (
                  <Button onClick={() => setReplaceOpen(true)} size="sm">Thay linh kiện</Button>
                )}
              </div>
              {!w.items || w.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Chưa có thay thế</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Linh kiện cũ</TableHead>
                      <TableHead>Linh kiện thay</TableHead>
                      <TableHead>Ghi chú</TableHead>
                      <TableHead>Thời gian</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {w.items.map((it) => (
                      <TableRow key={it.id}>
                        <TableCell>{it.removedComponent?.code ?? "-"}</TableCell>
                        <TableCell>{it.replacementComponent?.code ?? "-"}</TableCell>
                        <TableCell>{it.notes ?? "-"}</TableCell>
                        <TableCell>{formatDateTime(it.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          <ReplaceComponentDialog
            open={replaceOpen}
            onOpenChange={setReplaceOpen}
            warranty={w}
          />
        </TabsContent>

        <TabsContent value="actions">
          <Card>
            <CardContent className="space-y-3 p-4">
              {allowedTransitions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Đơn đã kết thúc</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {allowedTransitions.map((to) => (
                    <Button
                      key={to}
                      variant={to === WarrantyStatus.REJECTED ? "destructive" : "default"}
                      onClick={() => setPendingTransition(to)}
                    >
                      Chuyển sang {WARRANTY_STATUS_LABEL[to]}
                    </Button>
                  ))}
                </div>
              )}
              {w.status === WarrantyStatus.RECEIVED && (
                <div>
                  <Button variant="outline" onClick={() => setCancelOpen(true)}>Hủy đơn</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="mt-4">
        <CardContent className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Tệp đính kèm</h3>
          <AttachmentUploader relatedType="WARRANTY_CASE" relatedId={w.id} />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={pendingTransition !== null}
        onOpenChange={(o) => !o && setPendingTransition(null)}
        title="Xác nhận chuyển trạng thái"
        description={pendingTransition ? `Chuyển đơn sang ${WARRANTY_STATUS_LABEL[pendingTransition]}?` : ""}
        destructive={pendingTransition === WarrantyStatus.REJECTED}
        loading={transitionMut.isPending}
        onConfirm={async () => {
          if (!pendingTransition) return;
          await transitionMut.mutateAsync({ to: pendingTransition });
          toast.success("Đã cập nhật trạng thái");
          setPendingTransition(null);
        }}
      />

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Hủy đơn bảo hành"
        description="Đơn sẽ chuyển sang TỪ CHỐI và máy/linh kiện trở về trạng thái trước đó."
        destructive
        loading={cancelMut.isPending}
        onConfirm={async () => {
          await cancelMut.mutateAsync();
          toast.success("Đã hủy đơn");
        }}
      />
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm">{value}</div>
    </div>
  );
}

function ReplaceComponentDialog({
  open,
  onOpenChange,
  warranty,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warranty: WarrantyDetail;
}) {
  const replaceMut = useReplaceWarrantyComponent(warranty.id);
  const [removedId, setRemovedId] = React.useState<string | undefined>();
  const [replacement, setReplacement] = React.useState<SoldComponentOption | null>(null);
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    if (!open) {
      setRemovedId(undefined);
      setReplacement(null);
      setNotes("");
    }
  }, [open]);

  const submit = () => {
    if (!removedId) { toast.error("Chọn linh kiện cần thay"); return; }
    if (!replacement) { toast.error("Chọn linh kiện mới"); return; }
    replaceMut.mutate(
      {
        removedComponentId: removedId,
        replacementComponentId: replacement.id,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Đã ghi nhận thay linh kiện");
          onOpenChange(false);
        },
        onError: (err: any) =>
          toast.error(err?.response?.data?.error?.message ?? "Thao tác thất bại"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thay linh kiện</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Linh kiện cũ sẽ chuyển sang trạng thái Lỗi trong kho. Linh kiện mới (IN_STOCK) sẽ được lắp vào máy của khách.
        </p>
        <CurrentComponentSelect
          finishedPcId={warranty.finishedPc?.id}
          value={removedId}
          onChange={setRemovedId}
        />
        <InStockComponentPicker value={replacement} onChange={setReplacement} />
        <div>
          <label className="text-xs text-muted-foreground">Ghi chú</label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={replaceMut.isPending}>
            Hủy
          </Button>
          <Button onClick={submit} disabled={replaceMut.isPending}>
            {replaceMut.isPending ? "Đang xử lý..." : "Xác nhận"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CurrentComponentSelect({
  finishedPcId,
  value,
  onChange,
}: {
  finishedPcId?: string;
  value?: string;
  onChange: (id: string) => void;
}) {
  const { data } = useQuery({
    queryKey: ["finished-pc-detail-components", finishedPcId],
    queryFn: async () => {
      if (!finishedPcId) return [] as Array<{ id: string; code: string; categoryCode: string }>;
      const { data } = await (await import("@/lib/api-client")).apiClient.get(`/finished-pcs/${finishedPcId}`);
      const detail = (data?.data ?? data) as { currentComponents: Array<{ id: string; code: string; categoryCode: string }> };
      return detail.currentComponents ?? [];
    },
    enabled: !!finishedPcId,
  });
  return (
    <div>
      <label className="text-xs text-muted-foreground">Linh kiện cần thay</label>
      <select
        className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">-- Chọn linh kiện --</option>
        {(data ?? []).map((c) => (
          <option key={c.id} value={c.id}>{c.code} ({c.categoryCode})</option>
        ))}
      </select>
    </div>
  );
}

function InStockComponentPicker({
  value,
  onChange,
}: {
  value: SoldComponentOption | null;
  onChange: (v: SoldComponentOption | null) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const { data = [], isFetching } = useQuery({
    queryKey: ["warranty-replacement-search", q],
    queryFn: () => searchInStockComponents(q),
    staleTime: 15_000,
  });
  return (
    <div>
      <label className="text-xs text-muted-foreground">Linh kiện thay (IN_STOCK)</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" type="button" className="w-full justify-between">
            <span className="truncate">
              {value ? `${value.code} (${value.category.code})` : "Chọn linh kiện mới..."}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Tìm theo mã/serial..." value={q} onValueChange={setQ} />
            <CommandList>
              {isFetching && (
                <div className="flex items-center justify-center py-3 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang tìm...
                </div>
              )}
              {!isFetching && data.length === 0 && (
                <CommandEmpty>Không tìm thấy linh kiện</CommandEmpty>
              )}
              <CommandGroup>
                {data.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={c.id}
                    onSelect={() => { onChange(c); setOpen(false); }}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{c.code}</span>
                      <span className="text-xs text-muted-foreground">
                        {c.category.code}{c.serialNumber ? ` · ${c.serialNumber}` : ""}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
