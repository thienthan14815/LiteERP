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
import { COMPONENT_CATEGORY_LABEL } from "@/lib/labels";
import {
  searchSellableComponents,
  type SellableComponent,
} from "./api";

interface Props {
  value?: SellableComponent | null;
  onChange: (c: SellableComponent | null) => void;
  excludeIds?: string[];
}

export function SellableComponentCombobox({ value, onChange, excludeIds = [] }: Props) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["components", "sellable-search", query],
    queryFn: () => searchSellableComponents(query),
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
              ? `${value.code} · ${COMPONENT_CATEGORY_LABEL[value.categoryCode]}`
              : "Chọn linh kiện..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Tìm theo mã / model / serial..."
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
              <CommandEmpty>Không có linh kiện IN_STOCK phù hợp.</CommandEmpty>
            )}
            <CommandGroup>
              {filtered.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.id}
                  onSelect={() => {
                    onChange(c);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4", value?.id === c.id ? "opacity-100" : "opacity-0")}
                  />
                  <div className="flex flex-1 flex-col">
                    <span className="font-medium">
                      {c.code} · {COMPONENT_CATEGORY_LABEL[c.categoryCode]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {c.model ?? "-"} · {c.serial ?? "no serial"} · Vốn{" "}
                      {formatVnd(c.costPrice)}
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
