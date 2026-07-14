"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { ChevronsUpDown, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { CustomerCombobox } from "@/features/sale/customer-combobox";
import { useCreateWarranty } from "@/features/warranty/hooks";
import {
  searchWarrantableComponents,
  searchWarrantableFinishedPcs,
  type SoldComponentOption,
  type SoldFinishedPcOption,
} from "@/features/warranty/api";

type TargetMode = "FINISHED_PC" | "COMPONENT";

export default function NewWarrantyPage() {
  const router = useRouter();
  const [customerId, setCustomerId] = React.useState<string | undefined>();
  const [target, setTarget] = React.useState<TargetMode>("FINISHED_PC");
  const [pc, setPc] = React.useState<SoldFinishedPcOption | null>(null);
  const [comp, setComp] = React.useState<SoldComponentOption | null>(null);
  const [issue, setIssue] = React.useState("");
  const [receivedAt, setReceivedAt] = React.useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = React.useState("");

  const mut = useCreateWarranty();

  const submit = () => {
    if (!customerId) { toast.error("Chọn khách hàng"); return; }
    if (!issue.trim()) { toast.error("Mô tả lỗi"); return; }
    if (target === "FINISHED_PC" && !pc) { toast.error("Chọn máy đang bảo hành"); return; }
    if (target === "COMPONENT" && !comp) { toast.error("Chọn linh kiện đang bảo hành"); return; }
    mut.mutate(
      {
        customerId,
        finishedPcId: target === "FINISHED_PC" ? pc!.id : undefined,
        componentId: target === "COMPONENT" ? comp!.id : undefined,
        issue: issue.trim(),
        receivedAt: receivedAt ? new Date(receivedAt).toISOString() : undefined,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: (w) => {
          toast.success(`Đã tạo đơn ${w.code}`);
          router.push(`/warranties/detail?id=${w.id}`);
        },
        onError: (err: any) =>
          toast.error(err?.response?.data?.error?.message ?? "Tạo đơn thất bại"),
      },
    );
  };

  return (
    <div>
      <PageHeader title="Tạo đơn bảo hành" description="Tiếp nhận máy/linh kiện từ khách" />
      <Card>
        <CardContent className="space-y-4 p-4">
          <div>
            <Label>Khách hàng</Label>
            <CustomerCombobox value={customerId} onChange={(id) => setCustomerId(id)} />
          </div>

          <div className="grid gap-2">
            <Label>Đối tượng bảo hành</Label>
            <div className="flex gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={target === "FINISHED_PC"}
                  onChange={() => setTarget("FINISHED_PC")}
                />
                Máy tính
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={target === "COMPONENT"}
                  onChange={() => setTarget("COMPONENT")}
                />
                Linh kiện
              </label>
            </div>
          </div>

          {target === "FINISHED_PC" ? (
            <div>
              <Label>Máy đã bán</Label>
              <FinishedPcPicker value={pc} onChange={setPc} />
            </div>
          ) : (
            <div>
              <Label>Linh kiện đã bán</Label>
              <ComponentPicker value={comp} onChange={setComp} />
            </div>
          )}

          <div>
            <Label htmlFor="issue">Mô tả lỗi</Label>
            <Textarea
              id="issue"
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              rows={4}
              placeholder="VD: máy không khởi động, mất tín hiệu hình..."
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="receivedAt">Ngày nhận</Label>
              <Input
                id="receivedAt"
                type="date"
                value={receivedAt}
                onChange={(e) => setReceivedAt(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="notes">Ghi chú</Label>
              <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => router.back()} disabled={mut.isPending}>
              Hủy
            </Button>
            <Button onClick={submit} disabled={mut.isPending}>
              {mut.isPending ? "Đang lưu..." : "Tạo đơn"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FinishedPcPicker({
  value,
  onChange,
}: {
  value: SoldFinishedPcOption | null;
  onChange: (v: SoldFinishedPcOption | null) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const { data = [], isFetching } = useQuery({
    queryKey: ["warranty-pc-search", q],
    queryFn: () => searchWarrantableFinishedPcs(q),
    staleTime: 15_000,
  });
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" type="button" className="w-full justify-between">
          <span className="truncate">{value ? value.code : "Chọn máy đã bán..."}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Tìm theo mã máy..." value={q} onValueChange={setQ} />
          <CommandList>
            {isFetching && (
              <div className="flex items-center justify-center py-3 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang tìm...
              </div>
            )}
            {!isFetching && data.length === 0 && (
              <CommandEmpty>Không tìm thấy máy đã bán</CommandEmpty>
            )}
            <CommandGroup>
              {data.map((pc) => (
                <CommandItem
                  key={pc.id}
                  value={pc.id}
                  onSelect={() => { onChange(pc); setOpen(false); }}
                >
                  <span className="font-medium">{pc.code}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function ComponentPicker({
  value,
  onChange,
}: {
  value: SoldComponentOption | null;
  onChange: (v: SoldComponentOption | null) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const { data = [], isFetching } = useQuery({
    queryKey: ["warranty-comp-search", q],
    queryFn: () => searchWarrantableComponents(q),
    staleTime: 15_000,
  });
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" type="button" className="w-full justify-between">
          <span className="truncate">
            {value ? `${value.code}${value.serialNumber ? ` · ${value.serialNumber}` : ""}` : "Chọn linh kiện đã bán..."}
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
              <CommandEmpty>Không tìm thấy linh kiện đã bán</CommandEmpty>
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
  );
}
