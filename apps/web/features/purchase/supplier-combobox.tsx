"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  searchSuppliers,
  createSupplier,
  type SupplierOption,
  type CreateSupplierInput,
  type SupplierCategory,
} from "./api";

interface SupplierComboboxProps {
  value?: string;
  onChange: (id: string | undefined, supplier?: SupplierOption) => void;
}

export function SupplierCombobox({ value, onChange }: SupplierComboboxProps) {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<SupplierOption | null>(null);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["suppliers", "search", query],
    queryFn: () => searchSuppliers(query),
    staleTime: 30_000,
  });

  // When `value` is set externally and we don't have a label yet, try to resolve it.
  React.useEffect(() => {
    if (!value) {
      setSelected(null);
      return;
    }
    const fromResults = results.find((r) => r.id === value);
    if (fromResults) setSelected(fromResults);
  }, [value, results]);

  const createMut = useMutation({
    mutationFn: (payload: CreateSupplierInput) => createSupplier(payload),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      setSelected(s);
      onChange(s.id, s);
      setCreateOpen(false);
      toast.success("Đã tạo nhà cung cấp");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message ?? "Tạo nhà cung cấp thất bại");
    },
  });

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {selected?.name ?? "Chọn nhà cung cấp..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Tìm theo tên / mã..."
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              {isFetching && (
                <div className="flex items-center justify-center py-3 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang tìm...
                </div>
              )}
              {!isFetching && results.length === 0 && (
                <CommandEmpty>Không tìm thấy nhà cung cấp.</CommandEmpty>
              )}
              <CommandGroup>
                {results.map((s) => (
                  <CommandItem
                    key={s.id}
                    value={s.id}
                    onSelect={() => {
                      setSelected(s);
                      onChange(s.id, s);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === s.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {s.name}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup>
                <CommandItem
                  value="__create__"
                  onSelect={() => {
                    setOpen(false);
                    setCreateOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Thêm nhà cung cấp mới
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <CreateSupplierDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        initialName={query}
        isSubmitting={createMut.isPending}
        onSubmit={(payload) => createMut.mutate(payload)}
      />
    </>
  );
}

interface CreateSupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  isSubmitting: boolean;
  onSubmit: (payload: CreateSupplierInput) => void;
}

function CreateSupplierDialog({
  open,
  onOpenChange,
  initialName,
  isSubmitting,
  onSubmit,
}: CreateSupplierDialogProps) {
  const [name, setName] = React.useState(initialName ?? "");
  const [fbUrl, setFbUrl] = React.useState("");
  const [marketplaceUrl, setMarketplaceUrl] = React.useState("");
  const [category, setCategory] = React.useState<SupplierCategory | "">("");

  React.useEffect(() => {
    if (open) {
      setName(initialName ?? "");
      setFbUrl("");
      setMarketplaceUrl("");
      setCategory("");
    }
  }, [open, initialName]);

  const submit = () => {
    if (!name.trim()) {
      toast.error("Vui lòng nhập tên nhà cung cấp");
      return;
    }
    // Cho phép nhập cả link không có scheme — thêm https:// nếu thiếu để pass @IsUrl.
    const normalize = (s: string) => {
      const t = s.trim();
      if (!t) return undefined;
      return /^https?:\/\//i.test(t) ? t : `https://${t}`;
    };
    onSubmit({
      name: name.trim(),
      fbUrl: normalize(fbUrl),
      marketplaceUrl: normalize(marketplaceUrl),
      category: category || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm nhà cung cấp</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="sup-name">Tên</Label>
            <Input id="sup-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="sup-fb">FB URL</Label>
            <Input
              id="sup-fb"
              placeholder="https://facebook.com/..."
              value={fbUrl}
              onChange={(e) => setFbUrl(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="sup-mp">Marketplace Product URL</Label>
            <Input
              id="sup-mp"
              placeholder="https://shopee.tw/... hoặc https://ebay..."
              value={marketplaceUrl}
              onChange={(e) => setMarketplaceUrl(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="sup-cat">Thể loại</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as SupplierCategory)}>
              <SelectTrigger id="sup-cat"><SelectValue placeholder="Chọn thể loại..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="WHOLESALE">Bán buôn</SelectItem>
                <SelectItem value="RETAIL">Bán lẻ</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button onClick={submit} disabled={isSubmitting}>
            {isSubmitting ? "Đang lưu..." : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
