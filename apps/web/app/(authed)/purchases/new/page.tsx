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
import {
  COMPONENT_CATEGORY_LABEL,
  PURCHASE_ITEM_TYPE_LABEL,
} from "@/lib/labels";
import { useCreatePurchase } from "@/features/purchase/hooks";

const itemSchema = z
  .object({
    type: z.nativeEnum(PurchaseItemType),
    categoryCode: z.nativeEnum(ComponentCategoryCode).optional(),
    model: z.string().optional(),
    serial: z.string().optional(),
    purchasePrice: z.coerce.number().nonnegative("Giá phải >= 0"),
    notes: z.string().optional(),
  })
  .refine(
    (v) => v.type === PurchaseItemType.MACHINE || !!v.categoryCode,
    { message: "Vui lòng chọn loại linh kiện", path: ["categoryCode"] },
  );

const schema = z.object({
  supplierName: z.string().min(1, "Vui lòng nhập nhà cung cấp"),
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
      supplierName: "",
      notes: "",
      items: [
        {
          type: PurchaseItemType.MACHINE,
          purchasePrice: 0,
          model: "",
          serial: "",
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
      const result = await createMutation.mutateAsync(values);
      toast.success("Đã tạo phiếu mua (nháp)");
      router.push(`/purchases/${result.id}`);
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
                name="supplierName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nhà cung cấp</FormLabel>
                    <FormControl>
                      <Input placeholder="Tên nhà cung cấp" {...field} />
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
                      type: PurchaseItemType.MACHINE,
                      purchasePrice: 0,
                      model: "",
                      serial: "",
                      notes: "",
                    })
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Thêm mục
                </Button>
              </div>
              {fields.map((field, idx) => {
                const itemType = form.watch(`items.${idx}.type`);
                return (
                  <div
                    key={field.id}
                    className="grid gap-3 rounded-md border p-3 sm:grid-cols-12"
                  >
                    <FormField
                      control={form.control}
                      name={`items.${idx}.type`}
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
                              {Object.values(PurchaseItemType).map((t) => (
                                <SelectItem key={t} value={t}>
                                  {PURCHASE_ITEM_TYPE_LABEL[t]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {itemType === PurchaseItemType.COMPONENT && (
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
                      name={`items.${idx}.model`}
                      render={({ field }) => (
                        <FormItem className="sm:col-span-3">
                          <FormLabel>Model</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${idx}.serial`}
                      render={({ field }) => (
                        <FormItem className="sm:col-span-3">
                          <FormLabel>Serial</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${idx}.purchasePrice`}
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Giá mua (VND)</FormLabel>
                          <FormControl>
                            <Input type="number" min={0} {...field} />
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
