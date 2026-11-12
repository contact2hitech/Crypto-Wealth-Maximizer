"use client";

import React from "react";
import { ApiHealthProvider, useApiHealth } from "@/hooks/useApiHealth";
import { TopNav } from "@/components/layout/TopNav";
import { RESEARCH_DISCLAIMERS } from "@/lib/constants/disclaimers";

function AppFooter() {
  const { health } = useApiHealth();

  return (
    <footer className="border-t border-border/80 bg-[#070b12]">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>{RESEARCH_DISCLAIMERS.pythonSourceOfTruth}</p>
        <p className="shrink-0 font-mono tabular-nums text-[11px]">
          {health
            ? `Dataset: ${health.dataset.path_relative} (${health.dataset.row_count} rows · ${health.dataset.start_date} to ${health.dataset.end_date})`
            : "Dataset coverage: awaiting /api/health"}
        </p>
      </div>
    </footer>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ApiHealthProvider>
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <TopNav />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
        <AppFooter />
      </div>
    </ApiHealthProvider>
  );
}

