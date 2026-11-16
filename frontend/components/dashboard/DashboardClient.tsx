"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  Coins,
  Layers,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { ApiClientError, apiClient } from "@/lib/api";
import { downsampleByExtrema } from "@/lib/charts/downsample";
import { RESEARCH_DISCLAIMERS } from "@/lib/constants/disclaimers";
import { REFERENCE_BACKTEST_CONFIG } from "@/lib/constants/referenceConfig";
import {
  formatInteger,
  formatPercent,
  formatRatio,
  formatUsd,
  getTrendTone,
} from "@/lib/formatters/financial";
import type {
  ConstrainedBacktestResponse,
  ConstrainedTradeRow,
  MarketSummaryResponse,
} from "@/types/api";
import {
  buildComparisonRows,
  calculateHorizonYears,
  getBenchmarkComparabilityNotice,
  type ComparisonTableRow,
} from "@/lib/formatters/benchmarkComparisons";
import { ChartContainer } from "@/components/charts/ChartContainer";
import { ClientChartFrame } from "@/components/charts/ClientChartFrame";
import {
  dateToUtcTimestamp,
  formatAxisTimestamp,
  formatCompactUsdAxis,
  formatTooltipTimestamp,
} from "@/components/charts/chartFormatters";
import { CHART_COLORS } from "@/components/charts/chartTheme";
import { DataQualityBadge } from "@/components/common/DataQualityBadge";
import { DataTable, type DataTableColumn } from "@/components/common/DataTable";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState, MetricGridSkeleton } from "@/components/common/LoadingState";
import { MetricCard } from "@/components/common/MetricCard";
import { PageHeader } from "@/components/common/PageHeader";
import { ResearchWarningBanner } from "@/components/common/ResearchWarningBanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CombinedEquityChartRow {
  date: string;
  timestamp: number;
  strategy: number | null;
  bitcoin: number | null;
  ethereum: number | null;
  solana: number | null;
}

interface DrawdownChartRow {
  date: string;
  timestamp: number;
  strategy_dd: number | null;
  bitcoin_dd: number | null;
}

const CHART_MAX_POINTS = 450;

export function DashboardClient() {
  const [backtest, setBacktest] = useState<ConstrainedBacktestResponse | null>(null);
  const [marketSummary, setMarketSummary] = useState<MarketSummaryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [equityScale, setEquityScale] = useState<"linear" | "log">("log");
  const [reloadNonce, setReloadNonce] = useState<number>(0);

  const triggerReload = useCallback(() => {
    setReloadNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function loadDashboard() {
      setLoading(true);
      setError(null);
      try {
        const [backtestRes, summaryRes] = await Promise.all([
          apiClient.runConstrainedBacktest(REFERENCE_BACKTEST_CONFIG, controller.signal),
          apiClient.getMarketSummary({}, controller.signal),
        ]);
        if (!active || controller.signal.aborted) return;
        setBacktest(backtestRes);
        setMarketSummary(summaryRes);
      } catch (err) {
        if (!active || controller.signal.aborted) return;
        if (err instanceof ApiClientError && err.code === "REQUEST_ABORTED") return;
        setError({
          message:
            err instanceof Error
              ? err.message
              : "Failed to load dashboard simulation from FastAPI backend.",
          code: err instanceof ApiClientError ? err.code : undefined,
        });
      } finally {
        if (active && !controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();
    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadNonce]);

  const equityChartData = useMemo<CombinedEquityChartRow[]>(() => {
    if (!backtest) return [];
    const btcMap = new Map(
      (backtest.benchmark_curves.Bitcoin ?? []).map((p) => [p.date, p.value_usd])
    );
    const ethMap = new Map(
      (backtest.benchmark_curves.Ethereum ?? []).map((p) => [p.date, p.value_usd])
    );
    const solMap = new Map(
      (backtest.benchmark_curves.Solana ?? []).map((p) => [p.date, p.value_usd])
    );

    const merged: CombinedEquityChartRow[] = backtest.equity_curve.map((pt) => ({
      date: pt.date,
      timestamp: dateToUtcTimestamp(pt.date),
      strategy: pt.value_usd,
      bitcoin: btcMap.get(pt.date) ?? null,
      ethereum: ethMap.get(pt.date) ?? null,
      solana: solMap.get(pt.date) ?? null,
    }));

    return downsampleByExtrema(merged, CHART_MAX_POINTS, (row) => [
      row.strategy,
      row.bitcoin,
      row.ethereum,
      row.solana,
    ]);
  }, [backtest]);

  const drawdownChartData = useMemo<DrawdownChartRow[]>(() => {
    if (!backtest) return [];
    const btcDdMap = new Map(
      (backtest.benchmark_curves.Bitcoin ?? []).map((p) => [p.date, p.drawdown_pct])
    );
    const merged: DrawdownChartRow[] = backtest.equity_curve.map((pt) => ({
      date: pt.date,
      timestamp: dateToUtcTimestamp(pt.date),
      strategy_dd: pt.drawdown_pct,
      bitcoin_dd: btcDdMap.get(pt.date) ?? null,
    }));

    return downsampleByExtrema(merged, CHART_MAX_POINTS, (row) => [
      row.strategy_dd,
      row.bitcoin_dd,
    ]);
  }, [backtest]);

  const solanaStartDate = useMemo(() => {
    return (
      marketSummary?.asset_quality.find((a) => a.asset.toLowerCase().includes("solana"))
        ?.first_available_date ??
      backtest?.benchmark_curves?.Solana?.[0]?.date ??
      null
    );
  }, [marketSummary, backtest]);

  const comparisonRows = useMemo<ComparisonTableRow[]>(() => {
    if (!backtest) return [];
    return buildComparisonRows(backtest, solanaStartDate);
  }, [backtest, solanaStartDate]);

  const noticeInfo = useMemo(() => {
    if (!backtest) return null;
    return getBenchmarkComparabilityNotice(backtest, solanaStartDate);
  }, [backtest, solanaStartDate]);

  const latestAllocation = useMemo(() => {
    if (!backtest || backtest.equity_curve.length === 0) return null;
    return backtest.equity_curve[backtest.equity_curve.length - 1];
  }, [backtest]);

  const recentTrades = useMemo(() => {
    if (!backtest) return [];
    return [...backtest.trades].reverse();
  }, [backtest]);

  const comparisonColumns: DataTableColumn<ComparisonTableRow>[] = [
    {
      key: "label",
      header: "Strategy / Benchmark",
      render: (r) => (
        <div className="space-y-0.5">
          <span className="font-medium text-foreground">{r.label}</span>
          {r.is_partial ? (
            <div>
              <span className="inline-flex items-center rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                *Partial Window (Starts 2020-04-10)
              </span>
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: "period",
      header: "Evaluation Period",
      numeric: true,
      render: (r) => (
        <div className="text-xs font-mono tabular-nums leading-tight">
          <div className="text-foreground">{r.period_label}</div>
          <div className="text-[11px] text-muted-foreground">({r.horizon_years})</div>
        </div>
      ),
    },
    {
      key: "final_value",
      header: "Final Value",
      align: "right",
      numeric: true,
      render: (r) => formatUsd(r.final_value_usd),
    },
    {
      key: "total_return",
      header: "Total Return",
      align: "right",
      numeric: true,
      render: (r) => (
        <span className={getTrendTone(r.total_return_pct) === "positive" ? "text-emerald-400" : "text-rose-400"}>
          {formatPercent(r.total_return_pct)}
        </span>
      ),
    },
    {
      key: "cagr",
      header: "CAGR",
      align: "right",
      numeric: true,
      render: (r) => formatPercent(r.cagr_pct),
    },
    {
      key: "max_dd",
      header: "Max Drawdown",
      align: "right",
      numeric: true,
      render: (r) => <span className="text-rose-400">{formatPercent(r.maximum_drawdown_pct)}</span>,
    },
    {
      key: "volatility",
      header: "Volatility",
      align: "right",
      numeric: true,
      render: (r) => formatPercent(r.annualized_volatility_pct),
    },
    {
      key: "sharpe",
      header: "Sharpe (rf=0)",
      align: "right",
      numeric: true,
      render: (r) => formatRatio(r.sharpe_rf0),
    },
    {
      key: "switches",
      header: "Switches",
      align: "right",
      numeric: true,
      render: (r) => formatInteger(r.switches),
    },
    {
      key: "cash_days",
      header: "Cash Days",
      align: "right",
      numeric: true,
      render: (r) => formatInteger(r.cash_days),
    },
  ];

  const tradeColumns: DataTableColumn<ConstrainedTradeRow>[] = [
    {
      key: "date",
      header: "Signal Date",
      numeric: true,
      render: (r) => r.signal_date,
    },
    {
      key: "from",
      header: "From",
      render: (r) => r.from_asset,
    },
    {
      key: "to",
      header: "To",
      render: (r) => <span className="font-medium text-sky-300">{r.to_asset}</span>,
    },
    {
      key: "reason",
      header: "Decision Reason",
      render: (r) => r.reason ?? "—",
    },
    {
      key: "nav",
      header: "NAV After Fee",
      align: "right",
      numeric: true,
      render: (r) => formatUsd(r.portfolio_value_after_fee_usd),
    },
    {
      key: "dd",
      header: "DD at Decision",
      align: "right",
      numeric: true,
      render: (r) => formatPercent(r.drawdown_at_decision_pct),
    },
  ];

  const summary = backtest?.summary;
  const activeConfig = backtest?.configuration ?? REFERENCE_BACKTEST_CONFIG;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Research Dashboard"
        description="Reference historical backtest (Strategy A with Combined Protection) compared against Bitcoin, Ethereum, and Solana buy-and-hold benchmarks."
        badge={backtest ? `${backtest.date_range.start_date} to ${backtest.date_range.end_date}` : "Reference Backtest"}
        actions={
          <div className="flex items-center gap-2">
            {marketSummary ? (
              <DataQualityBadge
                status={marketSummary.data_quality_status === "valid" ? "valid" : "warning"}
                label={`Data: ${formatInteger(marketSummary.date_range.row_count)} days`}
              />
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={triggerReload}
              disabled={loading}
              className="gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        }
      />

      {error ? (
        <ErrorState
          title="Unable to compute reference dashboard"
          code={error.code}
          message={error.message}
          onRetry={triggerReload}
        />
      ) : null}

      {loading && !backtest ? (
        <div className="space-y-4">
          <LoadingState
            title="Running reference Strategy A backtest"
            description="Executing Python optimization_engine via POST /api/backtest/run (cold run ~3–4s)."
          />
          <MetricGridSkeleton count={8} />
        </div>
      ) : null}

      {/* In-Sample Retrospective Research Baseline Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3.5 py-2.5 text-xs text-sky-200">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded bg-sky-500/20 px-2 py-0.5 font-semibold text-sky-300">
            In-Sample Retrospective Research Baseline (2016–2026)
          </span>
          <span className="text-sky-200/90 hidden md:inline">
            Full-history retrospective backtest; out-of-sample walk-forward test period (2025–2026) is evaluated in Robustness.
          </span>
        </div>
        <span className="text-sky-300/80 font-mono text-[11px]">
          {backtest
            ? `Evaluation: ${backtest.date_range.start_date} → ${backtest.date_range.end_date} (${calculateHorizonYears(backtest.date_range.start_date, backtest.date_range.end_date)})`
            : "Evaluation: Canonical Historical Dataset"}
        </span>
      </div>

      {/* Core Performance KPIs */}
      <section aria-label="Portfolio performance KPIs" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Initial Capital"
          value={backtest ? formatUsd(backtest.configuration.initial_capital) : null}
          sublabel={backtest ? backtest.configuration.initialization_mode : "Reference starting capital"}
          icon={<Coins className="h-4 w-4" />}
          loading={loading && !backtest}
        />
        <MetricCard
          label="Final Portfolio Value"
          value={summary ? formatUsd(summary.final_value_usd) : null}
          sublabel={backtest ? `Through ${backtest.date_range.end_date}` : "Simulated end value"}
          tone={getTrendTone(summary?.total_return_pct)}
          icon={<ArrowUpRight className="h-4 w-4" />}
          loading={loading && !backtest}
        />
        <MetricCard
          label="Total Return"
          value={summary ? formatPercent(summary.total_return_pct) : null}
          sublabel={summary ? `CAGR: ${formatPercent(summary.cagr_pct)}` : "Cumulative compounded return"}
          tone={getTrendTone(summary?.total_return_pct)}
          icon={<Activity className="h-4 w-4" />}
          loading={loading && !backtest}
        />
        <MetricCard
          label="Maximum Drawdown"
          value={summary ? formatPercent(summary.maximum_drawdown_pct) : null}
          sublabel={summary ? `Annualized vol: ${formatPercent(summary.annualized_volatility_pct)}` : "Lifetime peak-to-trough"}
          tone="negative"
          icon={<ShieldCheck className="h-4 w-4" />}
          loading={loading && !backtest}
        />
        <MetricCard
          label="CAGR"
          value={summary ? formatPercent(summary.cagr_pct) : null}
          sublabel="Compound annual growth rate"
          tone={getTrendTone(summary?.cagr_pct)}
          loading={loading && !backtest}
        />
        <MetricCard
          label="Annualized Volatility"
          value={summary ? formatPercent(summary.annualized_volatility_pct) : null}
          sublabel="Daily std × √365"
          loading={loading && !backtest}
        />
        <MetricCard
          label="Sharpe Ratio (rf=0)"
          value={summary ? formatRatio(summary.sharpe_rf0) : null}
          sublabel="Zero risk-free rate assumption"
          tone={getTrendTone(summary?.sharpe_rf0)}
          loading={loading && !backtest}
        />
        <MetricCard
          label="Switches / Cash Days"
          value={
            summary
              ? `${formatInteger(summary.switches)} / ${formatInteger(summary.cash_days)}`
              : null
          }
          sublabel={
            backtest
              ? `Out of ${formatInteger(backtest.date_range.row_count)} evaluation days`
              : "Position switches and 0%-yield USD cash days"
          }
          icon={<Layers className="h-4 w-4" />}
          loading={loading && !backtest}
        />
      </section>

      {/* Equity Curve + Benchmarks Chart */}
      <ChartContainer
        title="Portfolio Equity Curve vs Buy-and-Hold Benchmarks (USD)"
        description="Daily simulated portfolio value compared against BTC, ETH, and SOL buy-and-hold benchmarks from Python optimization_engine."
        loading={loading && !backtest}
        error={error?.message ?? null}
        onRetry={triggerReload}
        isEmpty={!loading && !error && equityChartData.length === 0}
        heightClassName="min-h-[340px]"
        actions={
          <div className="flex items-center gap-1 rounded-md border border-border bg-secondary/60 p-0.5">
            <Button
              type="button"
              size="xs"
              variant={equityScale === "log" ? "default" : "ghost"}
              onClick={() => setEquityScale("log")}
            >
              Log
            </Button>
            <Button
              type="button"
              size="xs"
              variant={equityScale === "linear" ? "default" : "ghost"}
              onClick={() => setEquityScale("linear")}
            >
              Linear
            </Button>
          </div>
        }
        footnote={
          backtest
            ? `Rendered ${formatInteger(equityChartData.length)} extrema-preserving chart points from ${formatInteger(backtest.equity_curve.length)} backend daily observations. Solana benchmark begins on ${solanaStartDate} (connectNulls=false).`
            : undefined
        }
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS.strategy }} />
              <span className="text-foreground font-medium">Strategy A (Combined)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS.bitcoin }} />
              <span>Bitcoin Buy &amp; Hold</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS.benchmark }} />
              <span>Ethereum Buy &amp; Hold</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS.solana }} />
              <span>Solana Buy &amp; Hold (from {solanaStartDate})</span>
            </span>
          </div>
          <ClientChartFrame height={320}>
            <LineChart data={equityChartData} margin={{ top: 8, right: 12, left: 6, bottom: 4 }}>
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
                scale={equityScale}
                domain={equityScale === "log" ? ["auto", "auto"] : [0, "auto"]}
                tickFormatter={formatCompactUsdAxis}
                stroke={CHART_COLORS.axisText}
                fontSize={11}
                width={64}
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
                formatter={(value) => [
                  typeof value === "number" ? formatUsd(value) : "—",
                ]}
              />
              <Line
                type="linear"
                dataKey="strategy"
                name="Strategy A (Combined)"
                stroke={CHART_COLORS.strategy}
                strokeWidth={2}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
              <Line
                type="linear"
                dataKey="bitcoin"
                name="Bitcoin Buy & Hold"
                stroke={CHART_COLORS.bitcoin}
                strokeWidth={1.5}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
              <Line
                type="linear"
                dataKey="ethereum"
                name="Ethereum Buy & Hold"
                stroke={CHART_COLORS.benchmark}
                strokeWidth={1.5}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
              <Line
                type="linear"
                dataKey="solana"
                name="Solana Buy & Hold"
                stroke={CHART_COLORS.solana}
                strokeWidth={1.5}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ClientChartFrame>
        </div>
      </ChartContainer>

      {/* Underwater Drawdown Chart */}
      <ChartContainer
        title="Daily Underwater Drawdown (%)"
        description="Percentage decline from running portfolio high-water mark compared to Bitcoin buy-and-hold drawdown."
        loading={loading && !backtest}
        error={error?.message ?? null}
        onRetry={triggerReload}
        isEmpty={!loading && !error && drawdownChartData.length === 0}
        heightClassName="min-h-[280px]"
        footnote="Drawdown values come directly from backend lifetime peak-to-trough calculations. Daily-close stops do not cap intraday gap risk."
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS.drawdown }} />
              <span className="text-foreground font-medium">Strategy A Drawdown (%)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS.bitcoin }} />
              <span>Bitcoin Buy &amp; Hold Drawdown (%)</span>
            </span>
          </div>
          <ClientChartFrame height={260}>
            <AreaChart data={drawdownChartData} margin={{ top: 8, right: 12, left: 6, bottom: 4 }}>
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
                formatter={(value) => [
                  typeof value === "number" ? formatPercent(value) : "—",
                ]}
              />
              <Area
                type="linear"
                dataKey="strategy_dd"
                name="Strategy A Drawdown"
                stroke={CHART_COLORS.drawdown}
                fill={CHART_COLORS.drawdown}
                fillOpacity={0.18}
                strokeWidth={1.75}
                dot={false}
                isAnimationActive={false}
              />
              <Area
                type="linear"
                dataKey="bitcoin_dd"
                name="Bitcoin Drawdown"
                stroke={CHART_COLORS.bitcoin}
                fill="transparent"
                strokeWidth={1.25}
                strokeDasharray="4 3"
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ClientChartFrame>
        </div>
      </ChartContainer>

      {/* Allocation, Configuration & Market Overview Grid */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border-border/80 bg-card/90 shadow-none">
          <CardHeader className="border-b border-border/60 pb-3">
            <CardTitle className="flex items-center justify-between text-sm font-medium">
              <span>Current / Ending Allocation</span>
              <Badge
                variant="outline"
                className="border-sky-500/35 bg-sky-500/10 text-sky-300 font-mono text-xs"
              >
                {latestAllocation ? latestAllocation.holding : "—"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">As of Close Date</span>
              <span className="font-mono tabular-nums text-foreground">
                {latestAllocation?.date ?? "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Ending Portfolio Value</span>
              <span className="font-mono tabular-nums text-foreground">
                {latestAllocation ? formatUsd(latestAllocation.value_usd) : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Ending Underwater Drawdown</span>
              <span className="font-mono tabular-nums text-rose-400">
                {latestAllocation ? formatPercent(latestAllocation.drawdown_pct) : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">USD Cash Allocation Days</span>
              <span className="font-mono tabular-nums text-foreground">
                {summary ? formatInteger(summary.cash_days) : "—"}
              </span>
            </div>
            <div className="pt-2">
              <Link
                href="/strategy-lab"
                className="inline-flex items-center gap-1 text-xs font-medium text-sky-400 hover:text-sky-300"
              >
                <span>Interactive configuration arrives in Phase 4 Strategy Lab</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/90 shadow-none">
          <CardHeader className="border-b border-border/60 pb-3">
            <CardTitle className="flex items-center justify-between text-sm font-medium">
              <span>Reference Strategy Configuration</span>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-4 gap-y-2 pt-4 text-xs">
            <span className="text-muted-foreground">Strategy</span>
            <span className="text-right font-medium text-foreground">
              {activeConfig.strategy}
            </span>
            <span className="text-muted-foreground">Initialization</span>
            <span className="text-right text-foreground">
              {activeConfig.initialization_mode}
            </span>
            <span className="text-muted-foreground">Rebalancing / Min Hold</span>
            <span className="text-right font-mono tabular-nums text-foreground">
              {activeConfig.rebalance_frequency} / {activeConfig.minimum_holding_days}d
            </span>
            <span className="text-muted-foreground">Switch Threshold / Fee</span>
            <span className="text-right font-mono tabular-nums text-foreground">
              {activeConfig.switching_threshold_pct}% / {activeConfig.fee_bps_per_switch} bps
            </span>
            <span className="text-muted-foreground">Cash Filter / DD Stop</span>
            <span className="text-right font-mono tabular-nums text-foreground">
              {activeConfig.enable_cash_filter ? "On" : "Off"} / {activeConfig.drawdown_protection_pct}%
            </span>
            <span className="text-muted-foreground">Recovery Score / Warmup</span>
            <span className="text-right font-mono tabular-nums text-foreground">
              {activeConfig.cash_reentry_score_pct}% / {backtest ? (backtest.warmup_mode === "evaluation_window_only" ? "Eval window" : backtest.warmup_mode) : "Eval window"}
            </span>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/90 shadow-none">
          <CardHeader className="border-b border-border/60 pb-3">
            <CardTitle className="flex items-center justify-between text-sm font-medium">
              <span>Historical Market Overview</span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {marketSummary?.latest_closes.as_of_date ?? "—"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Bitcoin (BTC-USD)</span>
              <span className="font-mono tabular-nums text-foreground">
                {marketSummary ? formatUsd(marketSummary.latest_closes.Bitcoin) : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Ethereum (ETH-USD)</span>
              <span className="font-mono tabular-nums text-foreground">
                {marketSummary ? formatUsd(marketSummary.latest_closes.Ethereum) : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Solana (SOL-USD)</span>
              <span className="font-mono tabular-nums text-foreground">
                {marketSummary ? formatUsd(marketSummary.latest_closes.Solana) : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Dataset Window</span>
              <span className="font-mono tabular-nums text-foreground">
                {marketSummary
                  ? `${marketSummary.date_range.start_date} → ${marketSummary.date_range.end_date}`
                  : "—"}
              </span>
            </div>
            <div className="pt-2">
              <Link
                href="/markets"
                className="inline-flex items-center gap-1 text-xs font-medium text-sky-400 hover:text-sky-300"
              >
                <span>Explore full historical markets &amp; quality audit</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Benchmark Comparison Table */}
      <section className="space-y-3" aria-label="Strategy vs Buy-and-Hold Benchmarks">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-foreground">
            Reference Strategy vs Buy-and-Hold Benchmarks
          </h2>
          <span className="text-xs text-muted-foreground">
            Evaluation metrics computed from canonical daily series
          </span>
        </div>

        {/* Benchmark Comparability Notice Banner */}
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs text-amber-200">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-amber-300">
                Benchmark Comparability Notice: Differing Evaluation Horizons
              </p>
              <p className="leading-relaxed text-amber-200/90">
                Strategy A, Bitcoin, and Ethereum are evaluated over the full {noticeInfo?.strategyHorizonYears ?? "canonical"} dataset ({noticeInfo ? `${noticeInfo.fullStartDate} → ${noticeInfo.fullEndDate}` : "full history"}).
                Solana buy-and-hold begins on its first canonical observation date ({noticeInfo?.solanaStartDate ?? "first observation"}{noticeInfo?.solanaHorizonYears ? `, ${noticeInfo.solanaHorizonYears} horizon` : ""}).
                Solana&apos;s higher CAGR ({noticeInfo?.solanaCagrPct !== null && noticeInfo?.solanaCagrPct !== undefined ? formatPercent(noticeInfo.solanaCagrPct) : "—"}{noticeInfo?.solanaHorizonYears ? ` over ${noticeInfo.solanaHorizonYears}` : ""}) reflects this shorter, post-launch bull cycle and cannot be directly compared to {noticeInfo?.strategyHorizonYears ?? "full-history"} CAGRs.
                For a strictly fair comparison across all three assets over an identical evaluation window, visit the{" "}
                <Link href="/markets" className="underline font-semibold text-amber-100 hover:text-white">
                  Fair Common-Start Comparison on Markets
                </Link>.
              </p>
            </div>
          </div>
        </div>

        <DataTable
          columns={comparisonColumns}
          rows={comparisonRows}
          getRowKey={(row) => row.key}
          loading={loading && !backtest}
          emptyTitle="No benchmark comparison loaded"
          emptyDescription="Run the reference strategy backtest to view benchmark metrics."
          caption={
            noticeInfo && noticeInfo.solanaStartDate
              ? `Note: Solana buy-and-hold begins on ${noticeInfo.solanaStartDate} (${noticeInfo.solanaHorizonYears} horizon); Strategy A, Bitcoin, and Ethereum span the full ${noticeInfo.strategyHorizonYears} history (${noticeInfo.fullStartDate} to ${noticeInfo.fullEndDate}).`
              : "Note: Solana buy-and-hold begins on its first canonical observation date; Bitcoin and Ethereum span the full dataset history."
          }
        />
      </section>

      {/* Paginated Switching History */}
      <section className="space-y-3" aria-label="Reference Strategy Switch History">
        <h2 className="text-sm font-medium text-foreground">
          Position Switching History (Most Recent First)
        </h2>
        <DataTable
          columns={tradeColumns}
          rows={recentTrades}
          getRowKey={(row, idx) => `${row.signal_date}-${row.from_asset}-${row.to_asset}-${idx}`}
          loading={loading && !backtest}
          pageSize={10}
          emptyTitle="No position switches recorded"
          emptyDescription="Switches appear when strategy rules rotate holdings or trigger cash protection."
        />
      </section>

      {/* Research Warnings */}
      <ResearchWarningBanner
        title="Important Research Limitations & Risk Disclosures"
        items={
          backtest?.assumptions_and_limitations ?? [
            RESEARCH_DISCLAIMERS.globalBanner,
            RESEARCH_DISCLAIMERS.dailyStopCaveat,
            RESEARCH_DISCLAIMERS.walkForwardCaveat,
            RESEARCH_DISCLAIMERS.hindsightWarning,
          ]
        }
      />
    </div>
  );
}

