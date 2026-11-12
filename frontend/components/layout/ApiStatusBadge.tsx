"use client";

import React from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, WifiOff } from "lucide-react";
import { useApiHealth } from "@/hooks/useApiHealth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ApiStatusBadge({ compact = false }: { compact?: boolean }) {
  const { status, health, errorMessage, refresh } = useApiHealth();

  if (status === "checking") {
    return (
      <Badge
        variant="outline"
        className="gap-1.5 border-slate-600/50 bg-secondary/70 text-slate-300 text-xs font-normal"
      >
        <Loader2 className="h-3 w-3 animate-spin text-sky-400" />
        <span>Checking API...</span>
      </Badge>
    );
  }

  if (status === "connected" && health) {
    return (
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          title={`Backend: ${health.service} (${health.version}) | Dataset: ${health.dataset.start_date} to ${health.dataset.end_date} (${health.dataset.row_count} rows)`}
          className="gap-1.5 border-emerald-500/35 bg-emerald-500/10 text-emerald-300 text-xs font-medium"
        >
          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
          <span>API Connected</span>
          {!compact ? (
            <span className="hidden border-l border-emerald-500/30 pl-1.5 font-mono text-[11px] text-emerald-200/85 xl:inline tabular-nums">
              {health.dataset.start_date} – {health.dataset.end_date}
            </span>
          ) : null}
        </Badge>
      </div>
    );
  }

  if (status === "degraded") {
    return (
      <div className="flex items-center gap-1.5">
        <Badge
          variant="outline"
          title={errorMessage ?? "Dataset validation warning"}
          className="gap-1.5 border-amber-500/35 bg-amber-500/10 text-amber-300 text-xs font-medium"
        >
          <AlertTriangle className="h-3 w-3 text-amber-400" />
          <span>API Degraded</span>
        </Badge>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => void refresh()}
          aria-label="Retry API health check"
          className="text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Badge
        variant="outline"
        title={errorMessage ?? "Unable to connect to FastAPI backend"}
        className={cn(
          "gap-1.5 border-rose-500/35 bg-rose-500/10 text-rose-300 text-xs font-medium"
        )}
      >
        <WifiOff className="h-3 w-3 text-rose-400" />
        <span>API Offline</span>
      </Badge>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        onClick={() => void refresh()}
        aria-label="Retry API health check"
        className="text-muted-foreground hover:text-foreground"
      >
        <RefreshCw className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

