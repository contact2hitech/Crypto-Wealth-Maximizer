"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Coins,
  DollarSign,
  Percent,
  Play,
  RefreshCw,
  RotateCcw,
  Shield,
  ShieldAlert,
  TrendingDown,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ApiClientError, apiClient } from "@/lib/api";
import { downsampleByExtrema } from "@/lib/charts/downsample";
import { RESEARCH_DISCLAIMERS } from "@/lib/constants/disclaimers";
import { REFERENCE_BACKTEST_CONFIG } from "@/lib/constants/referenceConfig";
import {
  formatInteger,
  formatPercent,
  formatRatio,
  formatUsd,
} from "@/lib/formatters/financial";
import { validateRiskFormInput } from "@/lib/validation/strategyForm";
import type {
  DrawdownExitEvent,
  DrawdownTraceRow,
  EventCountSummary,
  RiskProtectionRequest,
  RiskProtectionResponse,
  StrategyName,
} from "@/types/api";
import { ChartContainer } from "@/components/charts/ChartContainer";
import { ClientChartFrame } from "@/components/charts/ClientChartFrame";
import {
  dateToUtcTimestamp,
  formatAxisTimestamp,
  formatTooltipTimestamp,
} from "@/components/charts/chartFormatters";
import { CHART_COLORS } from "@/components/charts/chartTheme";
import { DataTable, type DataTableColumn } from "@/components/common/DataTable";
import { ErrorState } from "@/components/common/ErrorState";
import { MetricCard } from "@/components/common/MetricCard";
import { PageHeader } from "@/components/common/PageHeader";
import { ResearchWarningBanner } from "@/components/common/ResearchWarningBanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TraceChartRow {
  date: string;
  timestamp: number;
  drawdown_pct: number | null;
  trigger_pct: number;
}

const STRATEGY_OPTIONS: StrategyName[] = [
  "A: 90-day momentum",
  "B: 50/200-day trend + momentum",
  "C: 30/90/180-day momentum",
];

const DD_STOP_OPTIONS = [5, 10, 15, 20, 25, 30, 40];
const RECOVERY_SCORE_OPTIONS = [-5, 0, 2, 5, 10];

export function RiskLabClient() {
  // Form Controls
  const [strategy, setStrategy] = useState<StrategyName>(REFERENCE_BACKTEST_CONFIG.strategy);
  const [ddProtection, setDdProtection] = useState<number>(REFERENCE_BACKTEST_CONFIG.drawdown_protection_pct);
  const [recoveryScore, setRecoveryScore] = useState<number>(REFERENCE_BACKTEST_CONFIG.cash_reentry_score_pct);
  const [enableCashFilter, setEnableCashFilter] = useState<boolean>(REFERENCE_BACKTEST_CONFIG.enable_cash_filter);
  const [enableDdStop, setEnableDdStop] = useState<boolean>(REFERENCE_BACKTEST_CONFIG.enable_drawdown_protection);
  const [startDate, setStartDate] = useState<string>(REFERENCE_BACKTEST_CONFIG.start_date);
  const [endDate, setEndDate] = useState<string>(REFERENCE_BACKTEST_CONFIG.end_date ?? "2026-11-10");

  // State
  const [riskData, setRiskData] = useState<RiskProtectionResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Payload
  const currentPayload = useMemo<RiskProtectionRequest>(() => ({
    strategy,
    initial_capital: REFERENCE_BACKTEST_CONFIG.initial_capital,
    start_date: startDate,
    end_date: endDate,
    rebalance_frequency: REFERENCE_BACKTEST_CONFIG.rebalance_frequency,
    minimum_holding_days: REFERENCE_BACKTEST_CONFIG.minimum_holding_days,
    switching_threshold_pct: REFERENCE_BACKTEST_CONFIG.switching_threshold_pct,
    fee_bps_per_switch: REFERENCE_BACKTEST_CONFIG.fee_bps_per_switch,
    drawdown_protection_pct: ddProtection,
    cash_reentry_score_pct: recoveryScore,
    initialization_mode: REFERENCE_BACKTEST_CONFIG.initialization_mode,
    allow_cash: true,
    enable_cash_filter: enableCashFilter,
    enable_drawdown_protection: enableDdStop,
    include_daily_trace: true,
  }), [strategy, ddProtection, recoveryScore, enableCashFilter, enableDdStop, startDate, endDate]);

  // Validation
  const validate = useCallback((): boolean => {
    const err = validateRiskFormInput({ startDate, endDate, drawdownProtectionPct: ddProtection });
    if (err) {
      setValidationError(err);
      return false;
    }
    setValidationError(null);
    return true;
  }, [startDate, endDate, ddProtection]);

  // Execute Analysis
  const runAnalysis = useCallback(async (signal?: AbortSignal) => {
    if (!validate()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.analyzeRiskProtection(currentPayload, signal);
      setRiskData(res);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "REQUEST_ABORTED") return;
      setError({
        message: err instanceof Error ? err.message : "Failed to analyze risk protection.",
        code: err instanceof ApiClientError ? err.code : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [currentPayload, validate]);

  // Reset
  const handleReset = useCallback(() => {
    setStrategy(REFERENCE_BACKTEST_CONFIG.strategy);
    setDdProtection(REFERENCE_BACKTEST_CONFIG.drawdown_protection_pct);
    setRecoveryScore(REFERENCE_BACKTEST_CONFIG.cash_reentry_score_pct);
    setEnableCashFilter(REFERENCE_BACKTEST_CONFIG.enable_cash_filter);
    setEnableDdStop(REFERENCE_BACKTEST_CONFIG.enable_drawdown_protection);
    setStartDate(REFERENCE_BACKTEST_CONFIG.start_date);
    setEndDate(REFERENCE_BACKTEST_CONFIG.end_date ?? "2026-11-10");
    setValidationError(null);
  }, []);

  // Initial load
  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function fetchInitial() {
      try {
        const res = await apiClient.analyzeRiskProtection(
          {
            strategy: REFERENCE_BACKTEST_CONFIG.strategy,
            initial_capital: REFERENCE_BACKTEST_CONFIG.initial_capital,
            start_date: REFERENCE_BACKTEST_CONFIG.start_date,
            end_date: REFERENCE_BACKTEST_CONFIG.end_date ?? "2026-11-10",
            rebalance_frequency: REFERENCE_BACKTEST_CONFIG.rebalance_frequency,
            minimum_holding_days: REFERENCE_BACKTEST_CONFIG.minimum_holding_days,
            switching_threshold_pct: REFERENCE_BACKTEST_CONFIG.switching_threshold_pct,
            fee_bps_per_switch: REFERENCE_BACKTEST_CONFIG.fee_bps_per_switch,
            drawdown_protection_pct: REFERENCE_BACKTEST_CONFIG.drawdown_protection_pct,
            cash_reentry_score_pct: REFERENCE_BACKTEST_CONFIG.cash_reentry_score_pct,
            initialization_mode: REFERENCE_BACKTEST_CONFIG.initialization_mode,
            allow_cash: true,
            enable_cash_filter: REFERENCE_BACKTEST_CONFIG.enable_cash_filter,
            enable_drawdown_protection: REFERENCE_BACKTEST_CONFIG.enable_drawdown_protection,
            include_daily_trace: true,
          },
          controller.signal
        );
        if (active) setRiskData(res);
      } catch (err) {
        if (active && !(err instanceof ApiClientError && err.code === "REQUEST_ABORTED")) {
          setError({
            message: err instanceof Error ? err.message : "Failed to analyze risk protection.",
            code: err instanceof ApiClientError ? err.code : undefined,
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void fetchInitial();
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  // Downsample Trace Drawdown Series for Responsive Charting
  const traceChartData = useMemo<TraceChartRow[]>(() => {
    if (!riskData || !riskData.daily_trace) return [];
    const trigger = -Math.abs(riskData.configuration.drawdown_protection_pct);

    const fullRows: TraceChartRow[] = riskData.daily_trace.map((r) => ({
      date: r.date,
      timestamp: dateToUtcTimestamp(r.date),
      drawdown_pct: r.drawdown_before_decision_pct,
      trigger_pct: trigger,
    }));

    return downsampleByExtrema(fullRows, 450, (row) => [row.drawdown_pct]);
  }, [riskData]);

  // Table Columns: Event Summary
  const eventSummaryColumns: DataTableColumn<EventCountSummary>[] = [
    {
      key: "event",
      header: "Protection Event Type",
      render: (row) => (
        <span className="font-medium text-foreground">
          {row.event}
        </span>
      ),
    },
    {
      key: "events",
      header: "Occurrences",
      numeric: true,
      render: (row) => (
        <span className="font-mono font-medium tabular-nums text-foreground">
          {formatInteger(row.events)}
        </span>
      ),
    },
    {
      key: "mean_drawdown_pct",
      header: "Mean DD at Trigger",
      numeric: true,
      render: (row) => (
        <span className="font-mono tabular-nums text-rose-400">
          {formatPercent(row.mean_drawdown_pct)}
        </span>
      ),
    },
    {
      key: "median_drawdown_pct",
      header: "Median DD at Trigger",
      numeric: true,
      render: (row) => (
        <span className="font-mono tabular-nums text-rose-400">
          {formatPercent(row.median_drawdown_pct)}
        </span>
      ),
    },
    {
      key: "worst_drawdown_pct",
      header: "Worst Recorded DD",
      numeric: true,
      render: (row) => (
        <span className="font-mono tabular-nums font-semibold text-rose-500">
          {formatPercent(row.worst_drawdown_pct)}
        </span>
      ),
    },
  ];

  // Table Columns: Drawdown Exits & Overshoot
  const exitColumns: DataTableColumn<DrawdownExitEvent>[] = [
    {
      key: "date",
      header: "Exit Date",
      render: (row) => <span className="font-mono text-xs text-foreground">{row.date}</span>,
    },
    {
      key: "from_asset",
      header: "Exited Asset",
      render: (row) => (
        <Badge variant="outline" className="border-border bg-secondary font-mono text-[11px]">
          {row.from_asset}
        </Badge>
      ),
    },
    {
      key: "to_asset",
      header: "Protection Target",
      render: (row) => (
        <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-300 font-mono text-[11px]">
          {row.to_asset}
        </Badge>
      ),
    },
    {
      key: "portfolio_value_usd",
      header: "Value at Exit",
      numeric: true,
      render: (row) => (
        <span className="font-mono tabular-nums text-foreground">
          {formatUsd(row.portfolio_value_usd)}
        </span>
      ),
    },
    {
      key: "drawdown_pct",
      header: "Exit Drawdown",
      numeric: true,
      render: (row) => (
        <span className="font-mono tabular-nums font-medium text-rose-400">
          {formatPercent(row.drawdown_pct)}
        </span>
      ),
    },
    {
      key: "overshoot_beyond_configured_trigger_pp",
      header: "Overshoot (pp)",
      numeric: true,
      render: (row) => (
        <span className="font-mono tabular-nums font-semibold text-amber-400">
          {row.overshoot_beyond_configured_trigger_pp !== null
            ? `+${row.overshoot_beyond_configured_trigger_pp.toFixed(2)} pp`
            : "—"}
        </span>
      ),
    },
    {
      key: "scheduled_rebalance",
      header: "Rebalance Day?",
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.scheduled_rebalance ? "Yes (Scheduled)" : "No (Stop Triggered)"}
        </span>
      ),
    },
  ];

  // Table Columns: Daily Drawdown Execution Trace
  const traceColumns: DataTableColumn<DrawdownTraceRow>[] = [
    {
      key: "date",
      header: "Date",
      render: (row) => <span className="font-mono text-xs">{row.date}</span>,
    },
    {
      key: "holding_during_interval",
      header: "Held Asset",
      render: (row) => (
        <Badge
          variant="outline"
          className={
            row.holding_during_interval === "USD Cash"
              ? "border-amber-500/35 bg-amber-500/10 text-amber-300 font-mono text-[10px]"
              : "border-border bg-secondary/50 font-mono text-[10px]"
          }
        >
          {row.holding_during_interval}
        </Badge>
      ),
    },
    {
      key: "portfolio_value_before_decision_usd",
      header: "Value Before Decision",
      numeric: true,
      render: (row) => (
        <span className="font-mono tabular-nums text-foreground">
          {formatUsd(row.portfolio_value_before_decision_usd)}
        </span>
      ),
    },
    {
      key: "close_to_close_portfolio_return_pct",
      header: "Day Return",
      numeric: true,
      render: (row) => (
        <span
          className={`font-mono tabular-nums ${
            (row.close_to_close_portfolio_return_pct ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"
          }`}
        >
          {formatPercent(row.close_to_close_portfolio_return_pct)}
        </span>
      ),
    },
    {
      key: "drawdown_before_decision_pct",
      header: "Drawdown",
      numeric: true,
      render: (row) => (
        <span className="font-mono tabular-nums text-rose-400">
          {formatPercent(row.drawdown_before_decision_pct)}
        </span>
      ),
    },
    {
      key: "decision",
      header: "System Decision",
      render: (row) => (
        <span className="text-xs text-muted-foreground truncate max-w-[180px] inline-block">
          {row.decision}
        </span>
      ),
    },
    {
      key: "holding_after_decision",
      header: "Holding After",
      render: (row) => (
        <span className="font-mono text-xs text-foreground">
          {row.holding_after_decision}
        </span>
      ),
    },
  ];

  const summary = riskData?.summary;
  const exitMetrics = riskData?.exit_metrics;

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Risk Analytics & Protection Lab"
        description="Evaluate close-to-close drawdown protection mechanics, trigger overshoot statistics, gap risk, and full daily execution traces."
        badge="Phase 4 Active"
      />

      {/* Interactive Controls Card */}
      <Card className="border-border/80 bg-card/90 shadow-none">
        <CardHeader className="border-b border-border/60 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Shield className="h-4 w-4 text-sky-400" />
              <span>Risk &amp; Drawdown Protection Controls</span>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={handleReset}
                disabled={loading}
                className="gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset Defaults</span>
              </Button>
              <Button
                type="button"
                variant="default"
                size="xs"
                onClick={() => void runAnalysis()}
                disabled={loading}
                className="gap-1.5 bg-sky-600 hover:bg-sky-500 text-white font-medium"
              >
                {loading ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5 fill-current" />
                )}
                <span>Run Risk Analysis</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {validationError && (
            <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-2.5 text-xs text-rose-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{validationError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-xs">
            {/* Strategy */}
            <div className="space-y-1.5">
              <label htmlFor="risk-strategy-select" className="text-muted-foreground font-medium">
                Momentum Strategy
              </label>
              <select
                id="risk-strategy-select"
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as StrategyName)}
                className="w-full rounded-md border border-border bg-secondary/60 px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                {STRATEGY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt} className="bg-popover text-popover-foreground">
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Drawdown Protection Trigger */}
            <div className="space-y-1.5">
              <label htmlFor="risk-dd-select" className="text-muted-foreground font-medium">
                Drawdown Stop Trigger (%)
              </label>
              <select
                id="risk-dd-select"
                value={ddProtection}
                onChange={(e) => setDdProtection(Number(e.target.value))}
                className="w-full rounded-md border border-border bg-secondary/60 px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                {DD_STOP_OPTIONS.map((opt) => (
                  <option key={opt} value={opt} className="bg-popover text-popover-foreground">
                    {opt}% peak-to-trough
                  </option>
                ))}
              </select>
            </div>

            {/* Cash Re-entry Threshold */}
            <div className="space-y-1.5">
              <label htmlFor="risk-reentry-select" className="text-muted-foreground font-medium">
                Cash Re-entry Threshold (%)
              </label>
              <select
                id="risk-reentry-select"
                value={recoveryScore}
                onChange={(e) => setRecoveryScore(Number(e.target.value))}
                className="w-full rounded-md border border-border bg-secondary/60 px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                {RECOVERY_SCORE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt} className="bg-popover text-popover-foreground">
                    {opt}% score
                  </option>
                ))}
              </select>
            </div>

            {/* Start Date */}
            <div className="space-y-1.5">
              <label htmlFor="risk-start-date" className="text-muted-foreground font-medium">
                Start Date
              </label>
              <input
                id="risk-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-md border border-border bg-secondary/60 px-2.5 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            {/* End Date */}
            <div className="space-y-1.5">
              <label htmlFor="risk-end-date" className="text-muted-foreground font-medium">
                End Date
              </label>
              <input
                id="risk-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-md border border-border bg-secondary/60 px-2.5 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Critical Stop-Loss & Intraday Gap Disclosure */}
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-200">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
          <div className="space-y-1.5">
            <p className="font-semibold text-amber-300">
              Critical Risk Disclosure: Daily-Close Stops &amp; Intraday Gap Risk
            </p>
            <p className="leading-relaxed text-amber-200/90">
              Drawdown protection triggers are evaluated strictly at <strong>daily close (00:00 UTC)</strong>.
              This is <strong>not</strong> an intraday continuous stop-loss system.
              In volatile market conditions, portfolio drawdowns may cross the configured trigger during the day or gap down overnight before a stop switch executes.
              Actual exit drawdowns frequently exceed the configured trigger threshold (overshoot).
              Drawdown protection does not guarantee a maximum loss.
            </p>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <ErrorState
          title="Risk Analysis Error"
          message={error.message}
          onRetry={() => void runAnalysis()}
        />
      )}

      {/* Risk KPI Metric Grid */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <MetricCard
          label="Lifetime Max DD"
          value={summary ? formatPercent(summary.lifetime_max_drawdown_pct ?? summary.maximum_drawdown_pct) : null}
          sublabel="Worst drawdown"
          icon={<TrendingDown className="h-4 w-4" />}
          tone="negative"
          loading={loading && !riskData}
        />
        <MetricCard
          label="Annual Volatility"
          value={summary ? formatPercent(summary.annualized_volatility_pct) : null}
          sublabel="Annualized daily"
          icon={<Percent className="h-4 w-4" />}
          loading={loading && !riskData}
        />
        <MetricCard
          label="Sharpe (rf=0)"
          value={summary ? formatRatio(summary.sharpe_rf0) : null}
          sublabel="Risk-adjusted return"
          icon={<Coins className="h-4 w-4" />}
          loading={loading && !riskData}
        />
        <MetricCard
          label="Cash Days"
          value={summary ? `${formatInteger(summary.cash_days)}d` : null}
          sublabel={
            riskData ? `Out of ${formatInteger(riskData.date_range.row_count)} days` : "USD cash allocation"
          }
          icon={<DollarSign className="h-4 w-4" />}
          loading={loading && !riskData}
        />
        <MetricCard
          label="Protection Exits"
          value={exitMetrics ? formatInteger(exitMetrics.total_drawdown_exits) : null}
          sublabel="Stop breach events"
          icon={<ShieldAlert className="h-4 w-4" />}
          loading={loading && !riskData}
        />
        <MetricCard
          label="Average Exit DD"
          value={exitMetrics ? formatPercent(exitMetrics.average_exit_drawdown_pct) : null}
          sublabel="Mean breach level"
          icon={<TrendingDown className="h-4 w-4" />}
          tone="negative"
          loading={loading && !riskData}
        />
        <MetricCard
          label="Worst Exit DD"
          value={exitMetrics ? formatPercent(exitMetrics.worst_exit_drawdown_pct) : null}
          sublabel={exitMetrics?.worst_exit_date ?? "Max single breach"}
          icon={<TrendingDown className="h-4 w-4 text-rose-500" />}
          tone="negative"
          loading={loading && !riskData}
        />
        <MetricCard
          label="Max Overshoot"
          value={
            exitMetrics?.max_overshoot_pp !== null && exitMetrics?.max_overshoot_pp !== undefined
              ? `+${exitMetrics.max_overshoot_pp.toFixed(2)} pp`
              : null
          }
          sublabel={
            exitMetrics?.average_overshoot_pp !== null && exitMetrics?.average_overshoot_pp !== undefined
              ? `Avg: +${exitMetrics.average_overshoot_pp.toFixed(2)} pp`
              : "Beyond stop level"
          }
          icon={<AlertCircle className="h-4 w-4 text-amber-400" />}
          loading={loading && !riskData}
        />
      </section>

      {/* Daily Underwater Drawdown Chart */}
      <ChartContainer
        title="Daily Underwater Drawdown & Protection Trigger Breaches"
        description="Continuous portfolio underwater drawdown profile with configured stop-loss trigger line and close-to-close breach events."
        loading={loading && !riskData}
        error={error?.message ?? null}
        onRetry={() => void runAnalysis()}
        isEmpty={!loading && !error && traceChartData.length === 0}
        footnote={
          riskData
            ? `Rendered ${formatInteger(traceChartData.length)} extrema points from ${formatInteger(riskData.daily_trace?.length ?? 0)} daily trace observations. Red dashed line indicates configured ${ddProtection}% drawdown stop.`
            : undefined
        }
      >
        <div className="space-y-3">
          <ClientChartFrame height={300}>
            <AreaChart data={traceChartData} margin={{ top: 8, right: 12, left: 6, bottom: 4 }}>
              <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
              <XAxis
                dataKey="timestamp"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tickFormatter={formatAxisTimestamp}
                stroke={CHART_COLORS.axisText}
                fontSize={11}
                minTickGap={40}
              />
              <YAxis
                domain={[-100, 0]}
                tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                stroke={CHART_COLORS.axisText}
                fontSize={11}
                width={52}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: CHART_COLORS.tooltipBg,
                  borderColor: CHART_COLORS.tooltipBorder,
                  borderRadius: "0.5rem",
                  fontSize: "12px",
                }}
                labelStyle={{ color: "#e2e8f0", fontFamily: "var(--font-geist-mono)" }}
                labelFormatter={(label) => formatTooltipTimestamp(label)}
                formatter={(value) => [typeof value === "number" ? formatPercent(value) : "—"]}
              />
              <ReferenceLine
                y={-Math.abs(ddProtection)}
                stroke="#f43f5e"
                strokeDasharray="4 4"
                label={{
                  value: `Trigger: -${Math.abs(ddProtection)}%`,
                  fill: "#f43f5e",
                  fontSize: 11,
                  position: "insideBottomLeft",
                }}
              />
              <Area
                type="linear"
                dataKey="drawdown_pct"
                name="Underwater Drawdown"
                stroke={CHART_COLORS.drawdown}
                fill={CHART_COLORS.drawdown}
                fillOpacity={0.2}
                strokeWidth={1.75}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ClientChartFrame>
        </div>
      </ChartContainer>

      {/* Event Summary Table */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">
          Protection &amp; Allocation Event Count Summary
        </h2>
        <DataTable
          columns={eventSummaryColumns}
          rows={riskData?.event_summary ?? []}
          getRowKey={(row) => row.event}
          loading={loading && !riskData}
          emptyTitle="No protection events recorded"
          emptyDescription="Run risk analysis above to compute protection event aggregates."
        />
      </section>

      {/* Drawdown Exits & Overshoot Table */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground">
            Drawdown Protection Exits &amp; Gap Overshoot Analysis
          </h2>
          <span className="text-xs text-muted-foreground">
            {riskData ? `${riskData.drawdown_exits.length} exit breaches` : ""}
          </span>
        </div>
        <DataTable
          columns={exitColumns}
          rows={riskData?.drawdown_exits ?? []}
          getRowKey={(row, idx) => `${row.date}-${row.from_asset}-${idx}`}
          loading={loading && !riskData}
          pageSize={10}
          emptyTitle="No drawdown exits recorded"
          emptyDescription="Portfolio did not breach the configured drawdown stop trigger during this period."
        />
      </section>

      {/* Paginated Daily Drawdown Execution Trace */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground">
            Daily Drawdown Execution Trace (Full Daily Resolution)
          </h2>
          <span className="text-xs text-muted-foreground font-mono">
            {riskData?.daily_trace ? `${riskData.daily_trace.length} evaluation days` : ""}
          </span>
        </div>
        <DataTable
          columns={traceColumns}
          rows={riskData?.daily_trace ?? []}
          getRowKey={(row) => row.date}
          loading={loading && !riskData}
          pageSize={15}
          emptyTitle="No trace data loaded"
          emptyDescription="Daily execution trace will populate once analysis runs."
        />
      </section>

      {/* Research Disclosures */}
      <ResearchWarningBanner
        title="Risk & Drawdown Caveats"
        items={
          riskData?.assumptions_and_limitations ?? [
            RESEARCH_DISCLAIMERS.dailyStopCaveat,
            RESEARCH_DISCLAIMERS.globalBanner,
          ]
        }
      />
    </div>
  );
}
