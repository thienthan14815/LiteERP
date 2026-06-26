import { Badge } from "@/components/ui/badge";
import { statusBadgeVariant } from "@/lib/labels";

interface StatusBadgeProps {
  status: string;
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <Badge variant={statusBadgeVariant(status)}>{label ?? status}</Badge>
  );
}
