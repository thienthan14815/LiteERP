"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  createCustomer,
  searchCustomers,
  type CreateCustomerInput,
  type CustomerOption,
} from "./api";

interface CustomerComboboxProps {
  value?: string;
  onChange: (id: string | undefined, customer?: CustomerOption) => void;
}

export function CustomerCombobox({ value, onChange }: CustomerComboboxProps) {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<CustomerOption | null>(null);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["customers", "search", query],
    queryFn: () => searchCustomers(query),
    staleTime: 15_000,
  });

  React.useEffect(() => {
    if (!value) { setSelected(null); return; }
    const inResults = results.find((r) => r.id === value);
    if (inResults) setSelected(inResults);
  }, [value, results]);

  const createMut = useMutation({
    mutationFn: (payload: CreateCustomerInput) => createCustomer(payload),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      setSelected(c);
      onChange(c.id, c);
      setCreateOpen(false);
      toast.success("Đã tạo khách hàng");
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error?.message ?? "Tạo khách hàng thất bại"),
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
            {selected ? `${selected.name}${selected.phone ? ` · ${selected.phone}` : ""}` : "Chọn khách hàng..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Tìm theo tên / SĐT..."
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
                <CommandEmpty>Không tìm thấy khách hàng.</CommandEmpty>
              )}
              <CommandGroup>
                {results.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={c.id}
                    onSelect={() => {
                      setSelected(c);
                      onChange(c.id, c);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn("mr-2 h-4 w-4", value === c.id ? "opacity-100" : "opacity-0")}
                    />
                    <div className="flex flex-1 flex-col">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {c.phone ?? "-"} · {c.code}
                      </span>
                    </div>
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
                  <Plus className="mr-2 h-4 w-4" /> Thêm khách hàng mới
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <CreateCustomerDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        initialName={query}
        isSubmitting={createMut.isPending}
        onSubmit={(p) => createMut.mutate(p)}
      />
    </>
  );
}

interface CreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  isSubmitting: boolean;
  onSubmit: (payload: CreateCustomerInput) => void;
}

function CreateCustomerDialog({
  open, onOpenChange, initialName, isSubmitting, onSubmit,
}: CreateDialogProps) {
  const [name, setName] = React.useState(initialName ?? "");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [address, setAddress] = React.useState("");

  React.useEffect(() => {
    if (open) setName(initialName ?? "");
  }, [open, initialName]);

  const submit = () => {
    if (!name.trim()) { toast.error("Vui lòng nhập tên khách hàng"); return; }
    onSubmit({
      name: name.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      address: address.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Thêm khách hàng</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="c-name">Tên</Label>
            <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="c-phone">SĐT</Label>
            <Input id="c-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="c-email">Email</Label>
            <Input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="c-addr">Địa chỉ</Label>
            <Input id="c-addr" value={address} onChange={(e) => setAddress(e.target.value)} />
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
