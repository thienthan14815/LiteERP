"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { cn, formatVnd } from "@/lib/utils";
import {
  searchReadyFinishedPcs,
  type FinishedPcListItem,
} from "@/features/finished-pc/api";

interface Props {
  value?: FinishedPcListItem | null;
  onChange: (pc: FinishedPcListItem | null) => void;
  excludeIds?: string[];
}

export function FinishedPcCombobox({ value, onChange, excludeIds = [] }: Props) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["finished-pcs", "ready-search", query],
    queryFn: () => searchReadyFinishedPcs(query),
    staleTime: 15_000,
  });

  const filtered = results.filter((r) => !excludeIds.includes(r.id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <span className="truncate">
            {value
              ? `${value.code} · ${formatVnd(value.costPrice)} → ${formatVnd(value.suggestedPrice)}`
              : "Chọn máy thành phẩm..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Tìm theo mã máy..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {isFetching && (
              <div className="flex items-center justify-center py-3 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang tìm...
              </div>
            )}
            {!isFetching && filtered.length === 0 && (
              <CommandEmpty>Không có máy READY_FOR_SALE.</CommandEmpty>
            )}
            <CommandGroup>
              {filtered.map((pc) => (
                <CommandItem
                  key={pc.id}
                  value={pc.id}
                  onSelect={() => {
                    onChange(pc);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4", value?.id === pc.id ? "opacity-100" : "opacity-0")}
                  />
                  <div className="flex flex-1 flex-col">
                    <span className="font-medium">{pc.code}</span>
                    <span className="text-xs text-muted-foreground">
                      Vốn: {formatVnd(pc.costPrice)} · Đề xuất:{" "}
                      {Number(pc.suggestedPrice) > 0 ? formatVnd(pc.suggestedPrice) : "chưa đặt"}
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
