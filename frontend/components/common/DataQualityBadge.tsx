import React from "react";
import { AlertTriangle, CheckCircle2, Clock, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type QualityStatus = "valid" | "warning" | "pending" | "offline";

interface DataQualityBadgeProps {
  status: QualityStatus;
  label?: string;
  className?: string;
}

const STATUS_STYLES: Record<
  QualityStatus,
  { defaultLabel: string; classes: string; Icon: typeof CheckCircle2 }
> = {
  valid: {
    defaultLabel: "Verified Dataset",
    classes: "border-emerald-500/35 bg-emerald-500/10 text-emerald-300",
    Icon: CheckCircle2,
  },
  warning: {
    defaultLabel: "Review Caveats",
    classes: "border-amber-500/35 bg-amber-500/10 text-amber-300",
    Icon: AlertTriangle,
  },
  pending: {
    defaultLabel: "Awaiting Sync",
    classes: "border-slate-500/35 bg-slate-500/10 text-slate-300",
    Icon: Clock,
  },
  offline: {
    defaultLabel: "Backend Offline",
    classes: "border-rose-500/35 bg-rose-500/10 text-rose-300",
    Icon: WifiOff,
  },
};

export function DataQualityBadge({ status, label, className }: DataQualityBadgeProps) {
  const { defaultLabel, classes, Icon } = STATUS_STYLES[status];
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 font-medium text-xs", classes, className)}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label ?? defaultLabel}</span>
    </Badge>
  );
}

