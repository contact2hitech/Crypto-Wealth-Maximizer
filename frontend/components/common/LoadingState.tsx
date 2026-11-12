import React from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface LoadingStateProps {
  title?: string;
  description?: string;
}

export function LoadingState({
  title = "Computing backend analytics",
  description = "Python calculation engines may take up to 20 seconds on cold analytical runs.",
}: LoadingStateProps) {
  return (
    <Card className="border-border/80 bg-card/90 shadow-none">
      <CardContent className="flex items-center gap-3.5 py-6">
        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-sky-400" />
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function MetricGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, idx) => (
        <Card key={idx} className="border-border/80 bg-card/90 shadow-none">
          <CardContent className="space-y-2.5 py-5">
            <Skeleton className="h-3.5 w-24 bg-secondary" />
            <Skeleton className="h-7 w-32 bg-secondary" />
            <Skeleton className="h-3 w-40 bg-secondary" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 rounded-lg border border-border/80 bg-card/90 p-4">
      <Skeleton className="h-8 w-full bg-secondary" />
      {Array.from({ length: rows }).map((_, idx) => (
        <Skeleton key={idx} className="h-7 w-full bg-secondary/70" />
      ))}
    </div>
  );
}

