"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { SalesItemType, ComponentCategoryCode } from "@app/shared";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COMPONENT_CATEGORY_LABEL } from "@/lib/labels";
import { formatVnd } from "@/lib/utils";
import { CustomerCombobox } from "@/features/sale/customer-combobox";
import { FinishedPcCombobox } from "@/features/sale/finished-pc-combobox";
import { SellableComponentCombobox } from "@/features/sale/sellable-component-combobox";
import { MasterOptionCombobox } from "@/features/master-option/master-option-combobox";
import { useCreateSale } from "@/features/sale/hooks";
import type { FinishedPcListItem } from "@/features/finished-pc/api";
import type { SellableComponent } from "@/features/sale/api";

interface Row {
  uid: string;
  itemType: SalesItemType;
  finishedPc?: FinishedPcListItem | null;
  component?: SellableComponent | null;
  // Chỉ áp dụng khi itemType = COMPONENT: lọc linh kiện theo category.
  filterCategory?: ComponentCategoryCode;
  unitPrice: number;
}

let uidSeq = 0;
const newUid = () => `r${++uidSeq}`;

export default function NewSalePage() {
  const router = useRouter();
  const createMut = useCreateSale();

  const [customerId, setCustomerId] = React.useState<string | undefined>();
  const [orderName, setOrderName] = React.useState("");
  const [sellerName, setSellerName] = React.useState("");
  const [platform, setPlatform] = React.useState("");
  const [salesUrl, setSalesUrl] = React.useState("");
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
    if (!customerId) { toast.error("Vui lòng chọn người mua"); return; }
    const trimmedUrl = salesUrl.trim();
    if (trimmedUrl) {
      try { new URL(trimmedUrl); }
      catch { toast.error("URL bán hàng không hợp lệ"); return; }
    }
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
        orderName: orderName.trim() || undefined,
        sellerName: sellerName.trim() || undefined,
        platform: platform.trim() || undefined,
        salesUrl: trimmedUrl || undefined,
        notes: notes.trim() || undefined,
        items,
      });
      toast.success("Đã tạo đơn bán (nháp)");
      router.push(`/sales/detail?id=${result.id}`);
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
          <div className="sm:col-span-2">
            <Label>Tên</Label>
            <Input
              value={orderName}
              onChange={(e) => setOrderName(e.target.value)}
              placeholder="Ví dụ: Bán PC gaming Shopee đơn 12/2026"
            />
          </div>
          <div>
            <Label>Người bán</Label>
            <MasterOptionCombobox
              type="SELLER"
              value={sellerName}
              onChange={setSellerName}
              placeholder="Chọn người bán..."
              searchPlaceholder="Tìm người bán..."
              emptyLabel="Chưa có người bán nào"
              addLabel="Thêm người bán mới"
              createDialogTitle="Thêm người bán"
              nameFieldLabel="Tên người bán"
            />
          </div>
          <div>
            <Label>Người mua *</Label>
            <CustomerCombobox value={customerId} onChange={(id) => setCustomerId(id)} />
          </div>
          <div>
            <Label>Nền tảng bán</Label>
            <MasterOptionCombobox
              type="SALES_PLATFORM"
              value={platform}
              onChange={setPlatform}
              placeholder="Chọn nền tảng..."
              searchPlaceholder="Tìm nền tảng..."
              emptyLabel="Chưa có nền tảng nào"
              addLabel="Thêm nền tảng mới"
              createDialogTitle="Thêm nền tảng bán"
              nameFieldLabel="Tên nền tảng"
            />
          </div>
          <div>
            <Label>URL bán hàng</Label>
            <Input
              type="url"
              value={salesUrl}
              onChange={(e) => setSalesUrl(e.target.value)}
              placeholder="https://..."
            />
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
              {row.itemType === SalesItemType.COMPONENT && (
                <div className="sm:col-span-2">
                  <Label>Loại LK</Label>
                  <Select
                    value={row.filterCategory ?? "ALL"}
                    onValueChange={(v) =>
                      updateRow(row.uid, {
                        filterCategory:
                          v === "ALL" ? undefined : (v as ComponentCategoryCode),
                        // Reset component nếu loại đổi để tránh không match.
                        component:
                          v !== "ALL" &&
                          row.component &&
                          row.component.categoryCode !== v
                            ? null
                            : row.component,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Tất cả" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Tất cả</SelectItem>
                      {Object.values(ComponentCategoryCode).map((c) => (
                        <SelectItem key={c} value={c}>
                          {COMPONENT_CATEGORY_LABEL[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div
                className={
                  row.itemType === SalesItemType.COMPONENT
                    ? "sm:col-span-4"
                    : "sm:col-span-6"
                }
              >
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
                    categoryCode={row.filterCategory}
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

