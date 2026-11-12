import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type MetricTone = "neutral" | "positive" | "negative" | "warning";

interface MetricCardProps {
  label: string;
  value: string | null | undefined;
  sublabel?: string;
  tone?: MetricTone;
  loading?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

const TONE_CLASSES: Record<MetricTone, string> = {
  neutral: "text-foreground",
  positive: "text-emerald-400",
  negative: "text-rose-400",
  warning: "text-amber-400",
};

export function MetricCard({
  label,
  value,
  sublabel,
  tone = "neutral",
  loading = false,
  icon,
  className,
}: MetricCardProps) {
  const displayValue = value ?? "—";

  return (
    <Card className={cn("border-border/80 bg-card/90 shadow-none", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </CardTitle>
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-7 w-28 bg-secondary" />
            <Skeleton className="h-3.5 w-36 bg-secondary" />
          </div>
        ) : (
          <>
            <div
              className={cn(
                "font-mono text-2xl font-semibold tracking-tight tabular-nums",
                displayValue === "—" ? "text-muted-foreground" : TONE_CLASSES[tone]
              )}
            >
              {displayValue}
            </div>
            {sublabel ? (
              <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

