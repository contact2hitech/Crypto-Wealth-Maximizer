"use client";

import React, { useSyncExternalStore } from "react";
import { ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

const emptySubscribe = () => () => {};

function useIsClient(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

interface ClientChartFrameProps {
  height?: number;
  children: React.ReactElement;
}

/**
 * Renders Recharts ResponsiveContainer only after client hydration so initial
 * container dimensions are always measured cleanly with zero console warnings.
 */
export function ClientChartFrame({ height = 320, children }: ClientChartFrameProps) {
  const isClient = useIsClient();

  if (!isClient) {
    return <Skeleton className="w-full bg-secondary/70" style={{ height }} />;
  }

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

