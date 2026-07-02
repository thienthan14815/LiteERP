"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  ComponentCategoryCode,
  PurchaseItemType,
} from "@app/shared";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  COMPONENT_CATEGORY_LABEL,
  PURCHASE_ITEM_TYPE_LABEL,
} from "@/lib/labels";
import { useUpdatePurchaseItem } from "./hooks";
import type { PurchaseItem } from "./api";

const schema = z
  .object({
    itemType: z.nativeEnum(PurchaseItemType),
    categoryCode: z.nativeEnum(ComponentCategoryCode).optional(),
    description: z.string().min(1, "Vui lòng nhập mô tả"),
    model: z.string().optional(),
    serial: z.string().optional(),
    quantity: z.coerce.number().int().min(1, "Số lượng tối thiểu 1"),
    unitPrice: z.coerce.number().nonnegative("Đơn giá phải >= 0"),
    notes: z.string().optional(),
  })
  .refine(
    (v) => v.itemType === PurchaseItemType.MACHINE || !!v.categoryCode,
    { message: "Vui lòng chọn loại linh kiện", path: ["categoryCode"] },
  );

type FormValues = z.infer<typeof schema>;

interface EditItemDialogProps {
  orderId: string;
  item: PurchaseItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditPurchaseItemDialog({
  orderId,
  item,
  open,
  onOpenChange,
}: EditItemDialogProps) {
  const mutation = useUpdatePurchaseItem(orderId);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      itemType: PurchaseItemType.MACHINE,
      description: "",
      model: "",
      serial: "",
      quantity: 1,
      unitPrice: 0,
      notes: "",
    },
  });

  React.useEffect(() => {
    if (item && open) {
      form.reset({
        itemType: item.itemType,
        categoryCode: item.categoryCode ?? undefined,
        description: item.description ?? "",
        model: item.model ?? "",
        serial: item.serial ?? "",
        quantity: item.quantity ?? 1,
        unitPrice: Number(item.unitPrice ?? 0),
        notes: item.notes ?? "",
      });
    }
  }, [item, open, form]);

  const itemType = form.watch("itemType");

  const onSubmit = async (values: FormValues) => {
    if (!item) return;
    try {
      await mutation.mutateAsync({
        itemId: item.id,
        payload: {
          itemType: values.itemType,
          description: values.description,
          model: values.model?.trim() ? values.model.trim() : "",
          serial: values.serial?.trim() ? values.serial.trim() : "",
          quantity: values.quantity,
          unitPrice: values.unitPrice,
          categoryCode:
            values.itemType === PurchaseItemType.COMPONENT
              ? values.categoryCode
              : undefined,
          notes: values.notes ?? "",
        },
      });
      toast.success("Đã cập nhật mục");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error?.message ?? "Cập nhật thất bại",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Sửa mục phiếu mua</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-3 sm:grid-cols-2"
          >
            <FormField
              control={form.control}
              name="itemType"
              render={({ field }) => (
                <FormItem>
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
                name="categoryCode"
                render={({ field }) => (
                  <FormItem>
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
                        {Object.values(ComponentCategoryCode).map((c) => (
                          <SelectItem key={c} value={c}>
                            {COMPONENT_CATEGORY_LABEL[c]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Mô tả</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="model"
              render={({ field }) => (
                <FormItem>
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
              name="serial"
              render={({ field }) => (
                <FormItem>
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
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Số lượng</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="unitPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Đơn giá (TWD)</FormLabel>
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
            <DialogFooter className="sm:col-span-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={mutation.isPending}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Đang lưu..." : "Lưu"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
