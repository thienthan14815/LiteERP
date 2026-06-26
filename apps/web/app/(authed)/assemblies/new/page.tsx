"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ComponentPicker } from "@/features/assembly/component-picker";
import { useCreateAssembly } from "@/features/assembly/hooks";
import {
  AssemblyRole,
  type ComponentOption,
} from "@/features/assembly/api";
import { formatVnd } from "@/lib/utils";

interface Row {
  uid: string;
  component: ComponentOption | null;
  role: AssemblyRole;
}

const ROLE_LABEL: Record<AssemblyRole, string> = {
  [AssemblyRole.CPU]: "CPU",
  [AssemblyRole.MB]: "Mainboard",
  [AssemblyRole.RAM]: "RAM",
  [AssemblyRole.SSD]: "SSD",
  [AssemblyRole.HDD]: "HDD",
  [AssemblyRole.GPU]: "GPU",
  [AssemblyRole.PSU]: "Nguồn",
  [AssemblyRole.CASE]: "Case",
  [AssemblyRole.FAN]: "Fan",
  [AssemblyRole.OTHER]: "Khác",
};

const CATEGORY_TO_ROLE: Record<string, AssemblyRole> = {
  CPU: AssemblyRole.CPU,
  MB: AssemblyRole.MB,
  RAM: AssemblyRole.RAM,
  SSD: AssemblyRole.SSD,
  HDD: AssemblyRole.HDD,
  GPU: AssemblyRole.GPU,
  PSU: AssemblyRole.PSU,
  CASE: AssemblyRole.CASE,
  FAN: AssemblyRole.FAN,
};

let uidSeq = 0;
const newUid = () => `r${++uidSeq}`;

export default function NewAssemblyPage() {
  const router = useRouter();
  const createMut = useCreateAssembly();

  const [name, setName] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [repairCost, setRepairCost] = React.useState<number | "">(0);
  const [cleaningCost, setCleaningCost] = React.useState<number | "">(0);
  const [assemblyCost, setAssemblyCost] = React.useState<number | "">(0);
  const [rows, setRows] = React.useState<Row[]>([
    { uid: newUid(), component: null, role: AssemblyRole.CPU },
  ]);

  const selectedIds = rows
    .map((r) => r.component?.id)
    .filter((x): x is string => !!x);

  const componentsTotal = rows.reduce(
    (s, r) => s + (r.component?.costPrice ?? 0),
    0,
  );
  const total =
    componentsTotal +
    Number(repairCost || 0) +
    Number(cleaningCost || 0) +
    Number(assemblyCost || 0);

  const addRow = () => {
    setRows((rs) => [
      ...rs,
      { uid: newUid(), component: null, role: AssemblyRole.OTHER },
    ]);
  };
  const removeRow = (uid: string) =>
    setRows((rs) => rs.filter((r) => r.uid !== uid));

  const updateRow = (uid: string, patch: Partial<Row>) => {
    setRows((rs) =>
      rs.map((r) => {
        if (r.uid !== uid) return r;
        const next = { ...r, ...patch };
        if (patch.component) {
          const inferred = CATEGORY_TO_ROLE[patch.component.categoryCode];
          if (inferred) next.role = inferred;
        }
        return next;
      }),
    );
  };

  const onSubmit = async () => {
    const items = rows
      .filter((r) => r.component)
      .map((r) => ({ componentId: r.component!.id, role: r.role }));
    if (items.length === 0) {
      toast.error("Cần ít nhất 1 linh kiện");
      return;
    }
    try {
      const result = await createMut.mutateAsync({
        name: name.trim() || undefined,
        notes: notes.trim() || undefined,
        repairCost: Number(repairCost || 0),
        cleaningCost: Number(cleaningCost || 0),
        assemblyCost: Number(assemblyCost || 0),
        items,
      });
      toast.success("Đã tạo phiếu lắp ráp (nháp)");
      router.push(`/assemblies/${result.id}`);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error?.message ?? "Không tạo được phiếu lắp ráp",
      );
    }
  };

  return (
    <div>
      <PageHeader
        title="Tạo phiếu lắp ráp"
        description="Chọn linh kiện trong kho và nhập chi phí"
      />

      <Card className="mb-4">
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
          <div>
            <Label>Tên phiếu (tuỳ chọn)</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Ghi chú</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Linh kiện</h3>
            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              <Plus className="mr-2 h-4 w-4" /> Thêm linh kiện
            </Button>
          </div>
          {rows.map((row) => (
            <div
              key={row.uid}
              className="grid gap-3 rounded-md border p-3 sm:grid-cols-12"
            >
              <div className="sm:col-span-7">
                <Label>Linh kiện</Label>
                <ComponentPicker
                  value={row.component}
                  excludeIds={selectedIds.filter((id) => id !== row.component?.id)}
                  onChange={(c) => updateRow(row.uid, { component: c })}
                />
              </div>
              <div className="sm:col-span-3">
                <Label>Vai trò</Label>
                <Select
                  value={row.role}
                  onValueChange={(v) =>
                    updateRow(row.uid, { role: v as AssemblyRole })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.values(AssemblyRole).map((r) => (
                      <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2 flex items-end justify-between">
                <span className="text-sm">
                  {row.component ? formatVnd(row.component.costPrice) : "-"}
                </span>
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
        <CardContent className="grid gap-4 p-4 sm:grid-cols-3">
          <div>
            <Label>Chi phí sửa (VND)</Label>
            <Input
              type="number"
              min={0}
              value={repairCost}
              onChange={(e) =>
                setRepairCost(e.target.value === "" ? "" : Number(e.target.value))
              }
            />
          </div>
          <div>
            <Label>Chi phí vệ sinh (VND)</Label>
            <Input
              type="number"
              min={0}
              value={cleaningCost}
              onChange={(e) =>
                setCleaningCost(e.target.value === "" ? "" : Number(e.target.value))
              }
            />
          </div>
          <div>
            <Label>Chi phí lắp ráp (VND)</Label>
            <Input
              type="number"
              min={0}
              value={assemblyCost}
              onChange={(e) =>
                setAssemblyCost(e.target.value === "" ? "" : Number(e.target.value))
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <div className="text-sm text-muted-foreground">
              Tổng giá linh kiện: {formatVnd(componentsTotal)}
            </div>
            <div className="text-lg font-semibold">
              Tổng giá thành dự kiến: {formatVnd(total)}
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
