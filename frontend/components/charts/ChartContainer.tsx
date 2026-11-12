import React from "react";
import { BarChart3 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { cn } from "@/lib/utils";

interface ChartContainerProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  footnote?: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  heightClassName?: string;
  className?: string;
  children?: React.ReactNode;
}

export function ChartContainer({
  title,
  description,
  actions,
  footnote,
  loading = false,
  error = null,
  onRetry,
  isEmpty = false,
  emptyTitle = "No chart series loaded",
  emptyDescription = "Series data will render here once returned by the Python backend.",
  heightClassName = "min-h-[280px]",
  className,
  children,
}: ChartContainerProps) {
  return (
    <Card className={cn("border-border/80 bg-card/90 shadow-none", className)}>
      <CardHeader className="flex flex-col gap-2 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-base font-medium text-foreground">
            {title}
          </CardTitle>
          {description ? (
            <CardDescription className="text-xs text-muted-foreground">
              {description}
            </CardDescription>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </CardHeader>

      <CardContent className={cn("pt-5", heightClassName)}>
        {loading ? (
          <LoadingState
            title="Loading chart series"
            description="Fetching computed series from the FastAPI backend."
          />
        ) : error ? (
          <ErrorState message={error} onRetry={onRetry} />
        ) : isEmpty ? (
          <EmptyState
            icon={<BarChart3 className="h-5 w-5" />}
            title={emptyTitle}
            description={emptyDescription}
          />
        ) : (
          children
        )}
      </CardContent>

      {footnote ? (
        <CardFooter className="border-t border-border/60 bg-secondary/20 py-2.5 text-xs text-muted-foreground">
          {footnote}
        </CardFooter>
      ) : null}
    </Card>
  );
}

