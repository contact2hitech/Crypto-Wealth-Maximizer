import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  title?: string;
  message: string;
  code?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Backend request failed",
  message,
  code,
  onRetry,
}: ErrorStateProps) {
  return (
    <Alert
      variant="destructive"
      className="border-rose-500/35 bg-rose-950/25 text-rose-100"
    >
      <AlertCircle className="h-4 w-4 text-rose-400" />
      <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <AlertTitle className="flex items-center gap-2 text-sm font-medium text-rose-100">
            <span>{title}</span>
            {code ? (
              <span className="rounded bg-rose-500/20 px-1.5 py-0.5 font-mono text-[11px] text-rose-300">
                {code}
              </span>
            ) : null}
          </AlertTitle>
          <AlertDescription className="mt-1 text-xs text-rose-200/85">
            {message}
          </AlertDescription>
        </div>
        {onRetry ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="w-fit border-rose-500/40 bg-rose-950/40 text-rose-100 hover:bg-rose-900/50"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Retry
          </Button>
        ) : null}
      </div>
    </Alert>
  );
}

