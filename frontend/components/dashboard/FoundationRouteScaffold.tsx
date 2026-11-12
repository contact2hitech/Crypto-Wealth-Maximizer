"use client";

import React from "react";
import { useApiHealth } from "@/hooks/useApiHealth";
import { PageHeader } from "@/components/common/PageHeader";
import { MetricCard } from "@/components/common/MetricCard";
import { DataQualityBadge, type QualityStatus } from "@/components/common/DataQualityBadge";
import { ErrorState } from "@/components/common/ErrorState";
import { ResearchWarningBanner } from "@/components/common/ResearchWarningBanner";
import { ChartContainer } from "@/components/charts/ChartContainer";
import { DataTable, type DataTableColumn } from "@/components/common/DataTable";
import { formatInteger } from "@/lib/formatters/financial";
import { RESEARCH_DISCLAIMERS } from "@/lib/constants/disclaimers";

export interface FoundationKpiSpec {
  label: string;
  sublabel: string;
}

export interface FoundationTableSpec {
  title: string;
  columns: { key: string; header: string; numeric?: boolean }[];
  emptyDescription: string;
}

interface FoundationRouteScaffoldProps {
  title: string;
  description: string;
  phaseBadge: string;
  kpis: FoundationKpiSpec[];
  chartTitle: string;
  chartDescription: string;
  chartEmptyDescription: string;
  table: FoundationTableSpec;
  warnings: readonly string[];
}

export function FoundationRouteScaffold({
  title,
  description,
  phaseBadge,
  kpis,
  chartTitle,
  chartDescription,
  chartEmptyDescription,
  table,
  warnings,
}: FoundationRouteScaffoldProps) {
  const { status, health, errorMessage, refresh } = useApiHealth();

  const qualityStatus: QualityStatus =
    status === "connected"
      ? "valid"
      : status === "degraded"
        ? "warning"
        : status === "offline"
          ? "offline"
          : "pending";

  const tableColumns: DataTableColumn<Record<string, never>>[] = table.columns.map(
    (col) => ({
      key: col.key,
      header: col.header,
      align: col.numeric ? "right" : "left",
      numeric: col.numeric,
      render: () => "—",
    })
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        badge={phaseBadge}
        actions={
          <DataQualityBadge
            status={qualityStatus}
            label={
              status === "connected" && health
                ? `Canonical CSV (${formatInteger(health.dataset.row_count)} rows)`
                : undefined
            }
          />
        }
      />

      {status === "offline" && errorMessage ? (
        <ErrorState
          title="FastAPI backend unreachable"
          code="NETWORK_ERROR"
          message={`${errorMessage} Start the FastAPI server (uvicorn backend.main:app --port 8000) and verify NEXT_PUBLIC_API_BASE_URL.`}
          onRetry={() => void refresh()}
        />
      ) : null}

      <section aria-label="Backend dataset telemetry" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="API Engine Status"
          value={health ? health.status.toUpperCase() : null}
          sublabel={health ? `Source of truth: ${health.engine_source_of_truth}` : "Checking /api/health"}
          tone={health?.status === "ok" ? "positive" : "neutral"}
          loading={status === "checking"}
        />
        <MetricCard
          label="Dataset Coverage"
          value={health ? `${health.dataset.start_date} → ${health.dataset.end_date}` : null}
          sublabel={health ? health.dataset.path_relative : "Canonical historical CSV"}
          loading={status === "checking"}
        />
        <MetricCard
          label="Daily Observations"
          value={health ? formatInteger(health.dataset.row_count) : null}
          sublabel={health ? `${health.dataset.assets_available.join(", ")}` : "BTC, ETH, SOL"}
          loading={status === "checking"}
        />
        <MetricCard
          label="Pre-Launch SOL Nulls"
          value={health ? formatInteger(health.dataset.missing_pre_launch_sol_days) : null}
          sublabel="Preserved without synthetic backfill"
          loading={status === "checking"}
        />
      </section>

      <section aria-label="Route analytical metrics">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Analytical Metrics (No Mock Values)
          </h2>
          <span className="text-xs text-muted-foreground">{phaseBadge}</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <MetricCard
              key={kpi.label}
              label={kpi.label}
              value={null}
              sublabel={kpi.sublabel}
            />
          ))}
        </div>
      </section>

      <ChartContainer
        title={chartTitle}
        description={chartDescription}
        isEmpty
        emptyTitle="Awaiting endpoint integration"
        emptyDescription={chartEmptyDescription}
        footnote={RESEARCH_DISCLAIMERS.pythonSourceOfTruth}
      />

      <section className="space-y-3" aria-label={table.title}>
        <h2 className="text-sm font-medium text-foreground">{table.title}</h2>
        <DataTable
          columns={tableColumns}
          rows={[]}
          getRowKey={(_, idx) => String(idx)}
          emptyTitle="No backend records queried yet"
          emptyDescription={table.emptyDescription}
        />
      </section>

      <ResearchWarningBanner
        title="Research Methodology & Interpretation Disclosures"
        items={[RESEARCH_DISCLAIMERS.globalBanner, ...warnings]}
      />
    </div>
  );
}

