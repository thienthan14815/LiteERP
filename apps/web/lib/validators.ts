import { z } from "zod";

// Shared Zod primitives used across forms.

export const emailSchema = z.string().email("Email khong hop le");
export const passwordSchema = z
  .string()
  .min(8, "Mat khau toi thieu 8 ky tu");
export const phoneSchema = z
  .string()
  .regex(/^[0-9+\-() ]{6,20}$/, "So dien thoai khong hop le")
  .optional()
  .or(z.literal(""));

export const moneySchema = z
  .number({ invalid_type_error: "Phai la so" })
  .nonnegative("Khong duoc am");
