import React from "react";
import { AlertTriangle, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface ResearchWarningBannerProps {
  title: string;
  items: readonly string[];
  variant?: "warning" | "info";
  className?: string;
}

export function ResearchWarningBanner({
  title,
  items,
  variant = "warning",
  className,
}: ResearchWarningBannerProps) {
  const isWarning = variant === "warning";

  return (
    <Alert
      className={cn(
        isWarning
          ? "border-amber-500/30 bg-amber-950/20 text-amber-100"
          : "border-sky-500/25 bg-sky-950/20 text-sky-100",
        className
      )}
    >
      {isWarning ? (
        <AlertTriangle className="h-4 w-4 text-amber-400" />
      ) : (
        <Info className="h-4 w-4 text-sky-400" />
      )}
      <AlertTitle
        className={cn(
          "text-sm font-medium",
          isWarning ? "text-amber-200" : "text-sky-200"
        )}
      >
        {title}
      </AlertTitle>
      <AlertDescription
        className={cn(
          "mt-1.5 text-xs leading-relaxed",
          isWarning ? "text-amber-100/80" : "text-sky-100/80"
        )}
      >
        {items.length === 1 ? (
          <p>{items[0]}</p>
        ) : (
          <ul className="list-disc space-y-1 pl-4">
            {items.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        )}
      </AlertDescription>
    </Alert>
  );
}

