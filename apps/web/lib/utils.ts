import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Đơn vị tiền tệ mặc định của UI. Đổi ở đây để áp dụng toàn app.
export const APP_CURRENCY = "TWD" as const;
export const APP_CURRENCY_SYMBOL = "NT$";

/**
 * Format số tiền theo đơn vị hệ thống (mặc định TWD / NT$).
 * Tên hàm giữ `formatVnd` cho tương thích backward — nội dung đã đổi sang TWD.
 * Chấp nhận cả number lẫn string (Prisma Decimal thường serialize ra string).
 */
export function formatVnd(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (n == null || Number.isNaN(n)) return `0 ${APP_CURRENCY}`;
  // vi-VN grouping (dấu chấm phân cách nghìn) + suffix TWD cho dễ đọc.
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(n)} ${APP_CURRENCY}`;
}

/** Alias có tên đúng nghĩa để dùng cho code mới. */
export const formatMoney = formatVnd;

export function formatNumber(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (n == null || Number.isNaN(n)) return "0";
  return new Intl.NumberFormat("vi-VN").format(n);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
