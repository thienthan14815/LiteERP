"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import {
  PurchaseItemType,
  ComponentCategoryCode,
} from "@app/shared";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { COMPONENT_CATEGORY_LABEL } from "@/lib/labels";
import { useCreatePurchase } from "@/features/purchase/hooks";
import { SupplierCombobox } from "@/features/purchase/supplier-combobox";
import { formatVnd } from "@/lib/utils";

// "Loại" hiển thị cho người dùng — 4 lựa chọn. Backend chỉ phân biệt
// MACHINE/COMPONENT: Máy bộ + PC + Laptop → MACHINE, Linh kiện → COMPONENT.
// Chỉ Máy bộ và Laptop yêu cầu model & serial; PC và Linh kiện chỉ cần miêu tả.
type ItemKind = "MAY_BO" | "PC" | "LAPTOP" | "LINH_KIEN";
const ITEM_KIND_OPTS: Array<{ value: ItemKind; label: string }> = [
  { value: "MAY_BO", label: "Máy bộ" },
  { value: "PC", label: "PC" },
  { value: "LAPTOP", label: "Laptop" },
  { value: "LINH_KIEN", label: "Linh kiện" },
];
const KIND_LABEL: Record<ItemKind, string> = {
  MAY_BO: "Máy bộ",
  PC: "PC",
  LAPTOP: "Laptop",
  LINH_KIEN: "Linh kiện",
};
const needsModelSerial = (k: ItemKind) => k === "MAY_BO" || k === "LAPTOP";

const itemSchema = z
  .object({
    kind: z.enum(["MAY_BO", "PC", "LAPTOP", "LINH_KIEN"]),
    categoryCode: z.nativeEnum(ComponentCategoryCode).optional(),
    description: z.string().optional(),
    model: z.string().optional(),
    serial: z.string().optional(),
    quantity: z.coerce.number().int().min(1, "Số lượng tối thiểu 1"),
    unitPrice: z.coerce.number().nonnegative("Đơn giá phải >= 0"),
    notes: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "LINH_KIEN" && !v.categoryCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["categoryCode"],
        message: "Vui lòng chọn loại linh kiện",
      });
    }
    if (needsModelSerial(v.kind) && !v.model?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["model"],
        message: "Vui lòng nhập model",
      });
    }
    if (!needsModelSerial(v.kind) && !v.description?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["description"],
        message: "Vui lòng nhập miêu tả",
      });
    }
  });

const schema = z.object({
  supplierId: z.string().optional(),
  otherCost: z.coerce.number().nonnegative("Chi phí khác phải >= 0").optional(),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, "Cần ít nhất 1 mục"),
});

type FormValues = z.infer<typeof schema>;

export default function NewPurchasePage() {
  const router = useRouter();
  const createMutation = useCreatePurchase();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      supplierId: undefined,
      otherCost: 0,
      notes: "",
      items: [
        {
          kind: "MAY_BO" as ItemKind,
          description: "",
          model: "",
          serial: "",
          quantity: 1,
          unitPrice: 0,
          notes: "",
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const onSubmit = async (values: FormValues) => {
    try {
      const payload = {
        supplierId: values.supplierId,
        otherCost: values.otherCost,
        notes: values.notes,
        items: values.items.map((it) => {
          const isComponent = it.kind === "LINH_KIEN";
          const withMS = needsModelSerial(it.kind);
          // Máy bộ/Laptop bỏ trống miêu tả → tự ghép "Loại + Model" để cột
          // Miêu tả ở danh sách máy luôn có nội dung.
          const description = it.description?.trim()
            ? it.description.trim()
            : `${KIND_LABEL[it.kind]} ${it.model?.trim() ?? ""}`.trim();
          return {
            itemType: isComponent
              ? PurchaseItemType.COMPONENT
              : PurchaseItemType.MACHINE,
            description,
            model: withMS && it.model?.trim() ? it.model.trim() : undefined,
            serial: withMS && it.serial?.trim() ? it.serial.trim() : undefined,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            categoryCode: isComponent ? it.categoryCode : undefined,
            notes: it.notes,
          };
        }),
      };
      const result = await createMutation.mutateAsync(payload);
      toast.success("Đã tạo phiếu mua (nháp)");
      router.push(`/purchases/detail?id=${result.id}`);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error?.message ?? "Không tạo được phiếu",
      );
    }
  };

  return (
    <div>
      <PageHeader title="Tạo phiếu mua" description="Nhập máy cũ hoặc linh kiện" />
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
        >
          <Card>
            <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="supplierId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nhà cung cấp</FormLabel>
                    <FormControl>
                      <SupplierCombobox
                        value={field.value}
                        onChange={(id) => field.onChange(id)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="otherCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chi phí khác (TWD)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Ghi chú</FormLabel>
                    <FormControl>
                      <Textarea rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Danh sách mục</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    append({
                      kind: "MAY_BO" as ItemKind,
                      description: "",
                      model: "",
                      serial: "",
                      quantity: 1,
                      unitPrice: 0,
                      notes: "",
                    })
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Thêm mục
                </Button>
              </div>
              {fields.map((field, idx) => {
                const kind = form.watch(`items.${idx}.kind`) as ItemKind;
                const withMS = needsModelSerial(kind);
                return (
                  <div
                    key={field.id}
                    className="grid gap-3 rounded-md border p-3 sm:grid-cols-12"
                  >
                    <FormField
                      control={form.control}
                      name={`items.${idx}.kind`}
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Loại</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {ITEM_KIND_OPTS.map((t) => (
                                <SelectItem key={t.value} value={t.value}>
                                  {t.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {kind === "LINH_KIEN" && (
                      <FormField
                        control={form.control}
                        name={`items.${idx}.categoryCode`}
                        render={({ field }) => (
                          <FormItem className="sm:col-span-2">
                            <FormLabel>Loại linh kiện</FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Chọn..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {Object.values(ComponentCategoryCode).map(
                                  (c) => (
                                    <SelectItem key={c} value={c}>
                                      {COMPONENT_CATEGORY_LABEL[c]}
                                    </SelectItem>
                                  ),
                                )}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    <FormField
                      control={form.control}
                      name={`items.${idx}.description`}
                      render={({ field }) => (
                        <FormItem
                          className={
                            kind === "LINH_KIEN"
                              ? "sm:col-span-3"
                              : "sm:col-span-5"
                          }
                        >
                          <FormLabel>
                            Miêu tả{withMS ? " (tuỳ chọn)" : ""}
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder={
                                withMS
                                  ? "Bỏ trống sẽ tự ghép: Loại + Model"
                                  : kind === "PC"
                                    ? "VD: PC văn phòng i5 gen 8, 16GB RAM"
                                    : "VD: RAM DDR4 8GB Kingston"
                              }
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${idx}.quantity`}
                      render={({ field }) => (
                        <FormItem className="sm:col-span-1">
                          <FormLabel>SL</FormLabel>
                          <FormControl>
                            <Input type="number" min={1} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${idx}.unitPrice`}
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Đơn giá (TWD)</FormLabel>
                          <FormControl>
                            <Input type="number" min={0} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {/* Thành tiền — readonly, tính theo SL × đơn giá */}
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Thành tiền</FormLabel>
                      <div className="flex h-10 items-center justify-end rounded-md border bg-muted px-3 text-sm font-medium">
                        {formatVnd(
                          (Number(form.watch(`items.${idx}.quantity`)) || 0) *
                            (Number(form.watch(`items.${idx}.unitPrice`)) || 0),
                        )}
                      </div>
                    </FormItem>
                    {/* Model + Serial: chỉ Máy bộ và Laptop mới cần khai. */}
                    {withMS && (
                      <>
                        <FormField
                          control={form.control}
                          name={`items.${idx}.model`}
                          render={({ field }) => (
                            <FormItem className="sm:col-span-6">
                              <FormLabel>Model</FormLabel>
                              <FormControl>
                                <Input placeholder="VD: Dell Optiplex 7050 MFF" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`items.${idx}.serial`}
                          render={({ field }) => (
                            <FormItem className="sm:col-span-6">
                              <FormLabel>Serial</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder={
                                    Number(form.watch(`items.${idx}.quantity`)) > 1
                                      ? "Nhập trên từng máy sau khi tách"
                                      : "VD: SN123456"
                                  }
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}
                    <FormField
                      control={form.control}
                      name={`items.${idx}.notes`}
                      render={({ field }) => (
                        <FormItem className="sm:col-span-12">
                          <FormLabel>Ghi chú</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex items-end sm:col-span-12 sm:justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(idx)}
                        disabled={fields.length === 1}
                      >
                        <Trash2 className="mr-1 h-4 w-4" />
                        Xóa
                      </Button>
                    </div>
                  </div>
                );
              })}
              {form.formState.errors.items?.root && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.items.root.message}
                </p>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Đang lưu..." : "Lưu nháp"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
