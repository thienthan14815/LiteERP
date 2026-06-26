import { z } from "zod";
import { AssemblyRole } from "./api";

export const assemblyItemSchema = z.object({
  componentId: z.string().min(1),
  role: z.nativeEnum(AssemblyRole),
});

export const createAssemblySchema = z.object({
  name: z.string().optional(),
  notes: z.string().optional(),
  repairCost: z.coerce.number().nonnegative().optional(),
  cleaningCost: z.coerce.number().nonnegative().optional(),
  assemblyCost: z.coerce.number().nonnegative().optional(),
  items: z.array(assemblyItemSchema).min(1, "Cần ít nhất 1 linh kiện"),
});

export type CreateAssemblyValues = z.infer<typeof createAssemblySchema>;

export const updateAssemblySchema = createAssemblySchema.partial();
export type UpdateAssemblyValues = z.infer<typeof updateAssemblySchema>;
