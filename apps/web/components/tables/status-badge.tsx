import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
}

type Tone = "success" | "info" | "warning" | "danger" | "neutral";

const TONE_STYLES: Record<Tone, string> = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  info: "bg-sky-50 text-sky-700 ring-sky-200",
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  danger: "bg-rose-50 text-rose-700 ring-rose-200",
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
};

function toneFor(status: string): Tone {
  switch (status) {
    case "CONFIRMED":
    case "COMPLETED":
    case "READY":
    case "READY_FOR_SALE":
    case "IN_STOCK":
      return "success";
    case "INSPECTING":
    case "ASSEMBLING":
    case "IN_PROGRESS":
    case "TESTING":
    case "RESERVED":
      return "warning";
    case "CANCELLED":
    case "DEFECTIVE":
    case "SCRAP":
    case "SCRAPPED":
    case "REJECTED":
    case "LOST":
      return "danger";
    case "SOLD":
    case "DELIVERING":
      return "info";
    default:
      return "neutral";
  }
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const tone = toneFor(status);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        TONE_STYLES[tone],
        className,
      )}
    >
      {label ?? status}
    </span>
  );
}
