import { z } from "zod";

export const updateFinishedPcSchema = z.object({
  suggestedPrice: z.coerce.number().nonnegative().optional(),
  notes: z.string().optional(),
});

export type UpdateFinishedPcValues = z.infer<typeof updateFinishedPcSchema>;
