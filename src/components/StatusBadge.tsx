import { STATUS_BADGE_CLASS, STATUS_LABEL } from "@/lib/business";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("daiki-badge", STATUS_BADGE_CLASS[status] || "bg-muted text-muted-foreground")}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
