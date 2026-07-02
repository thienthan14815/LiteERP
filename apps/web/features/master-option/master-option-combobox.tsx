"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  createMasterOption,
  listMasterOptions,
  type MasterOption,
  type MasterOptionType,
} from "./api";

interface Props {
  type: MasterOptionType;
  value: string;
  onChange: (name: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  addLabel?: string;
  createDialogTitle?: string;
  nameFieldLabel?: string;
}

export function MasterOptionCombobox({
  type,
  value,
  onChange,
  placeholder = "Chọn...",
  searchPlaceholder = "Tìm...",
  emptyLabel = "Chưa có mục nào",
  addLabel = "Thêm mới",
  createDialogTitle = "Thêm mục",
  nameFieldLabel = "Tên",
}: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [initialName, setInitialName] = React.useState("");

  const { data: options = [], isFetching } = useQuery({
    queryKey: ["master-options", type],
    queryFn: () => listMasterOptions(type),
    staleTime: 30_000,
  });

  const lowerQuery = query.trim().toLowerCase();
  const filtered = React.useMemo(
    () =>
      lowerQuery
        ? options.filter((o) => o.name.toLowerCase().includes(lowerQuery))
        : options,
    [options, lowerQuery],
  );

  const createMut = useMutation({
    mutationFn: (payload: { name: string; notes?: string }) =>
      createMasterOption({ type, name: payload.name, notes: payload.notes }),
    onSuccess: (o) => {
      qc.invalidateQueries({ queryKey: ["master-options", type] });
      onChange(o.name);
      setCreateOpen(false);
      setQuery("");
      toast.success("Đã thêm mục");
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error?.message ?? "Thêm thất bại"),
  });

  const openCreateWith = (name: string) => {
    setInitialName(name);
    setOpen(false);
    setCreateOpen(true);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className={cn(!value && "text-muted-foreground")}>
              {value || placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] p-0"
          align="start"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={searchPlaceholder}
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              {isFetching && (
                <div className="flex items-center justify-center py-3 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang tải...
                </div>
              )}
              {!isFetching && filtered.length === 0 && (
                <CommandEmpty>{emptyLabel}</CommandEmpty>
              )}
              <CommandGroup>
                {filtered.map((o: MasterOption) => (
                  <CommandItem
                    key={o.id}
                    value={o.id}
                    onSelect={() => {
                      onChange(o.name);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === o.name ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex flex-1 flex-col">
                      <span className="font-medium">{o.name}</span>
                      {o.notes && (
                        <span className="text-xs text-muted-foreground">
                          {o.notes}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup>
                <CommandItem
                  value="__create__"
                  onSelect={() => openCreateWith(query.trim())}
                >
                  <Plus className="mr-2 h-4 w-4" /> {addLabel}
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <CreateMasterOptionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={createDialogTitle}
        nameLabel={nameFieldLabel}
        initialName={initialName}
        isSubmitting={createMut.isPending}
        onSubmit={(p) => createMut.mutate(p)}
      />
    </>
  );
}

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  nameLabel: string;
  initialName?: string;
  isSubmitting: boolean;
  onSubmit: (payload: { name: string; notes?: string }) => void;
}

function CreateMasterOptionDialog({
  open,
  onOpenChange,
  title,
  nameLabel,
  initialName,
  isSubmitting,
  onSubmit,
}: DialogProps) {
  const [name, setName] = React.useState(initialName ?? "");
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setName(initialName ?? "");
      setNotes("");
    }
  }, [open, initialName]);

  const submit = () => {
    if (!name.trim()) {
      toast.error("Vui lòng nhập tên");
      return;
    }
    onSubmit({ name: name.trim(), notes: notes.trim() || undefined });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="mo-name">{nameLabel}</Label>
            <Input
              id="mo-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="mo-notes">Ghi chú</Label>
            <Textarea
              id="mo-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
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
