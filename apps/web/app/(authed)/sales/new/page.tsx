"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { SalesItemType } from "@app/shared";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { formatVnd } from "@/lib/utils";
import { CustomerCombobox } from "@/features/sale/customer-combobox";
import { FinishedPcCombobox } from "@/features/sale/finished-pc-combobox";
import { SellableComponentCombobox } from "@/features/sale/sellable-component-combobox";
import { useCreateSale } from "@/features/sale/hooks";
import type { FinishedPcListItem } from "@/features/finished-pc/api";
import type { SellableComponent } from "@/features/sale/api";

interface Row {
  uid: string;
  itemType: SalesItemType;
  finishedPc?: FinishedPcListItem | null;
  component?: SellableComponent | null;
  unitPrice: number;
}

let uidSeq = 0;
const newUid = () => `r${++uidSeq}`;

export default function NewSalePage() {
  const router = useRouter();
  const createMut = useCreateSale();

  const [customerId, setCustomerId] = React.useState<string | undefined>();
  const [notes, setNotes] = React.useState("");
  const [rows, setRows] = React.useState<Row[]>([
    { uid: newUid(), itemType: SalesItemType.FINISHED_PC, unitPrice: 0 },
  ]);

  const addRow = () =>
    setRows((rs) => [...rs, { uid: newUid(), itemType: SalesItemType.FINISHED_PC, unitPrice: 0 }]);
  const removeRow = (uid: string) => setRows((rs) => rs.filter((r) => r.uid !== uid));

  const updateRow = (uid: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));

  const totalRevenue = rows.reduce((s, r) => s + Number(r.unitPrice || 0), 0);
  // Prisma Decimal → JSON string; phải Number() coerce trước khi cộng.
  const totalCost = rows.reduce((s, r) => {
    if (r.itemType === SalesItemType.FINISHED_PC) return s + Number(r.finishedPc?.costPrice ?? 0);
    if (r.itemType === SalesItemType.COMPONENT) return s + Number(r.component?.costPrice ?? 0);
    return s;
  }, 0);
  const estProfit = totalRevenue - totalCost;

  const onSubmit = async () => {
    if (!customerId) { toast.error("Vui lòng chọn khách hàng"); return; }
    const items = rows
      .map((r) => {
        if (r.itemType === SalesItemType.FINISHED_PC && r.finishedPc) {
          return {
            itemType: SalesItemType.FINISHED_PC,
            finishedPcId: r.finishedPc.id,
            unitPrice: Number(r.unitPrice || 0),
            qty: 1,
          };
        }
        if (r.itemType === SalesItemType.COMPONENT && r.component) {
          return {
            itemType: SalesItemType.COMPONENT,
            componentId: r.component.id,
            unitPrice: Number(r.unitPrice || 0),
            qty: 1,
          };
        }
        return null;
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
    if (items.length === 0) { toast.error("Cần ít nhất 1 mục bán"); return; }

    try {
      const result = await createMut.mutateAsync({
        customerId,
        notes: notes.trim() || undefined,
        items,
      });
      toast.success("Đã tạo đơn bán (nháp)");
      router.push(`/sales/${result.id}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Không tạo được đơn bán");
    }
  };

  const selectedFinishedPcIds = rows
    .map((r) => r.finishedPc?.id)
    .filter((x): x is string => !!x);
  const selectedComponentIds = rows
    .map((r) => r.component?.id)
    .filter((x): x is string => !!x);

  return (
    <div>
      <PageHeader
        title="Tạo đơn bán hàng"
        description="Bán máy thành phẩm hoặc linh kiện rời"
      />

      <Card className="mb-4">
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
          <div>
            <Label>Khách hàng *</Label>
            <CustomerCombobox value={customerId} onChange={(id) => setCustomerId(id)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Ghi chú</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Sản phẩm</h3>
            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              <Plus className="mr-2 h-4 w-4" /> Thêm mục
            </Button>
          </div>

          {rows.map((row) => (
            <div key={row.uid} className="grid gap-3 rounded-md border p-3 sm:grid-cols-12">
              <div className="sm:col-span-3">
                <Label>Loại</Label>
                <ItemTypeToggle
                  value={row.itemType}
                  onChange={(t) =>
                    updateRow(row.uid, { itemType: t, finishedPc: null, component: null, unitPrice: 0 })
                  }
                />
              </div>
              <div className="sm:col-span-6">
                <Label>Mặt hàng</Label>
                {row.itemType === SalesItemType.FINISHED_PC ? (
                  <FinishedPcCombobox
                    value={row.finishedPc ?? null}
                    excludeIds={selectedFinishedPcIds.filter(
                      (id) => id !== row.finishedPc?.id,
                    )}
                    onChange={(pc) =>
                      updateRow(row.uid, {
                        finishedPc: pc,
                        unitPrice: pc ? Number(pc.suggestedPrice || pc.costPrice) : 0,
                      })
                    }
                  />
                ) : (
                  <SellableComponentCombobox
                    value={row.component ?? null}
                    excludeIds={selectedComponentIds.filter(
                      (id) => id !== row.component?.id,
                    )}
                    onChange={(c) =>
                      updateRow(row.uid, {
                        component: c,
                        unitPrice: c ? Math.round(c.costPrice * 1.2) : 0,
                      })
                    }
                  />
                )}
              </div>
              <div className="sm:col-span-2">
                <Label>Đơn giá (TWD)</Label>
                <Input
                  type="number"
                  min={0}
                  value={row.unitPrice}
                  onChange={(e) =>
                    updateRow(row.uid, { unitPrice: Number(e.target.value || 0) })
                  }
                />
              </div>
              <div className="sm:col-span-1 flex items-end justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRow(row.uid)}
                  disabled={rows.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <div className="text-sm text-muted-foreground">
              Tổng doanh thu: {formatVnd(totalRevenue)}
            </div>
            <div className="text-sm text-muted-foreground">
              Tổng giá vốn: {formatVnd(totalCost)}
            </div>
            <div className="text-lg font-semibold">
              Lợi nhuận ước tính: {formatVnd(estProfit)}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.back()}>Hủy</Button>
            <Button onClick={onSubmit} disabled={createMut.isPending}>
              {createMut.isPending ? "Đang lưu..." : "Lưu nháp"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ItemTypeToggle({
  value, onChange,
}: { value: SalesItemType; onChange: (t: SalesItemType) => void }) {
  return (
    <div className="flex gap-2">
      <Button
        type="button"
        variant={value === SalesItemType.FINISHED_PC ? "default" : "outline"}
        size="sm"
        className="flex-1"
        onClick={() => onChange(SalesItemType.FINISHED_PC)}
      >
        Máy
      </Button>
      <Button
        type="button"
        variant={value === SalesItemType.COMPONENT ? "default" : "outline"}
        size="sm"
        className="flex-1"
        onClick={() => onChange(SalesItemType.COMPONENT)}
      >
        Linh kiện
      </Button>
    </div>
  );
}

