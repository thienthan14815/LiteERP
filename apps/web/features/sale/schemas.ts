import { z } from "zod";
import { SalesItemType } from "@app/shared";

export const saleItemSchema = z
  .object({
    itemType: z.nativeEnum(SalesItemType),
    finishedPcId: z.string().optional(),
    componentId: z.string().optional(),
    unitPrice: z.coerce.number().nonnegative(),
    qty: z.coerce.number().int().min(1).optional(),
  })
  .refine(
    (v) =>
      v.itemType === SalesItemType.FINISHED_PC
        ? !!v.finishedPcId
        : !!v.componentId,
    { message: "Thiếu mặt hàng" },
  );

export const createSaleSchema = z.object({
  customerId: z.string().min(1, "Vui lòng chọn khách hàng"),
  notes: z.string().optional(),
  items: z.array(saleItemSchema).min(1, "Cần ít nhất 1 mục bán"),
});

export type CreateSaleValues = z.infer<typeof createSaleSchema>;

export const updateSaleSchema = createSaleSchema.partial();
export type UpdateSaleValues = z.infer<typeof updateSaleSchema>;
