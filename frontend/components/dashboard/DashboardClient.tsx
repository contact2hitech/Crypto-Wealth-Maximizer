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
import { ChartContainer } from "@/components/charts/ChartContainer";
import { ClientChartFrame } from "@/components/charts/ClientChartFrame";
import {
  formatAxisDate,
  formatCompactUsdAxis,
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
  strategy: number | null;
  bitcoin: number | null;
  ethereum: number | null;
  solana: number | null;
}

interface DrawdownChartRow {
  date: string;
  strategy_dd: number | null;
  bitcoin_dd: number | null;
}

interface ComparisonTableRow {
  key: string;
  label: string;
  final_value_usd: number | null;
  total_return_pct: number | null;
  cagr_pct: number | null;
  maximum_drawdown_pct: number | null;
  annualized_volatility_pct: number | null;
  sharpe_rf0: number | null;
  switches: number;
  cash_days: number;
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
      strategy_dd: pt.drawdown_pct,
      bitcoin_dd: btcDdMap.get(pt.date) ?? null,
    }));

    return downsampleByExtrema(merged, CHART_MAX_POINTS, (row) => [
      row.strategy_dd,
      row.bitcoin_dd,
    ]);
  }, [backtest]);

  const comparisonRows = useMemo<ComparisonTableRow[]>(() => {
    if (!backtest) return [];
    const strategyRow: ComparisonTableRow = {
      key: "strategy",
      label: `${backtest.summary.strategy} (Combined Protection)`,
      final_value_usd: backtest.summary.final_value_usd,
      total_return_pct: backtest.summary.total_return_pct,
      cagr_pct: backtest.summary.cagr_pct,
      maximum_drawdown_pct: backtest.summary.maximum_drawdown_pct,
      annualized_volatility_pct: backtest.summary.annualized_volatility_pct,
      sharpe_rf0: backtest.summary.sharpe_rf0,
      switches: backtest.summary.switches,
      cash_days: backtest.summary.cash_days,
    };
    const benchmarkRows: ComparisonTableRow[] = backtest.benchmark_summaries.map((b) => ({
      key: b.strategy,
      label: b.strategy,
      final_value_usd: b.final_value_usd,
      total_return_pct: b.total_return_pct,
      cagr_pct: b.cagr_pct,
      maximum_drawdown_pct: b.maximum_drawdown_pct,
      annualized_volatility_pct: b.annualized_volatility_pct,
      sharpe_rf0: b.sharpe_rf0,
      switches: b.switches,
      cash_days: b.cash_days,
    }));
    return [strategyRow, ...benchmarkRows];
  }, [backtest]);

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
      render: (r) => <span className="font-medium text-foreground">{r.label}</span>,
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
            ? `Rendered ${formatInteger(equityChartData.length)} extrema-preserving chart points from ${formatInteger(backtest.equity_curve.length)} backend daily observations. Solana benchmark begins on 2020-04-10 (connectNulls=false).`
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
              <span>Solana Buy &amp; Hold (from 2020-04-10)</span>
            </span>
          </div>
          <ClientChartFrame height={320}>
            <LineChart data={equityChartData} margin={{ top: 8, right: 12, left: 6, bottom: 4 }}>
              <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={formatAxisDate}
                stroke={CHART_COLORS.axisText}
                fontSize={11}
                minTickGap={36}
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
                formatter={(value) => [
                  typeof value === "number" ? formatUsd(value) : "—",
                ]}
              />
              <Line
                type="monotone"
                dataKey="strategy"
                name="Strategy A (Combined)"
                stroke={CHART_COLORS.strategy}
                strokeWidth={2}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="bitcoin"
                name="Bitcoin Buy & Hold"
                stroke={CHART_COLORS.bitcoin}
                strokeWidth={1.5}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="ethereum"
                name="Ethereum Buy & Hold"
                stroke={CHART_COLORS.benchmark}
                strokeWidth={1.5}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
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
                dataKey="date"
                tickFormatter={formatAxisDate}
                stroke={CHART_COLORS.axisText}
                fontSize={11}
                minTickGap={36}
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
                formatter={(value) => [
                  typeof value === "number" ? formatPercent(value) : "—",
                ]}
              />
              <Area
                type="monotone"
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
                type="monotone"
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
              {backtest?.configuration.strategy ?? REFERENCE_BACKTEST_CONFIG.strategy}
            </span>
            <span className="text-muted-foreground">Initialization</span>
            <span className="text-right text-foreground">
              {backtest?.configuration.initialization_mode ?? REFERENCE_BACKTEST_CONFIG.initialization_mode}
            </span>
            <span className="text-muted-foreground">Rebalancing / Min Hold</span>
            <span className="text-right font-mono tabular-nums text-foreground">
              {REFERENCE_BACKTEST_CONFIG.rebalance_frequency} / {REFERENCE_BACKTEST_CONFIG.minimum_holding_days}d
            </span>
            <span className="text-muted-foreground">Switch Threshold / Fee</span>
            <span className="text-right font-mono tabular-nums text-foreground">
              {REFERENCE_BACKTEST_CONFIG.switching_threshold_pct}% / {REFERENCE_BACKTEST_CONFIG.fee_bps_per_switch} bps
            </span>
            <span className="text-muted-foreground">Cash Filter / DD Stop</span>
            <span className="text-right font-mono tabular-nums text-foreground">
              On / {REFERENCE_BACKTEST_CONFIG.drawdown_protection_pct}%
            </span>
            <span className="text-muted-foreground">Recovery Score / Warmup</span>
            <span className="text-right font-mono tabular-nums text-foreground">
              {REFERENCE_BACKTEST_CONFIG.cash_reentry_score_pct}% / Eval window
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
        <h2 className="text-sm font-medium text-foreground">
          Reference Strategy vs Buy-and-Hold Benchmarks
        </h2>
        <DataTable
          columns={comparisonColumns}
          rows={comparisonRows}
          getRowKey={(row) => row.key}
          loading={loading && !backtest}
          emptyTitle="No benchmark comparison loaded"
          emptyDescription="Run the reference strategy backtest to view benchmark metrics."
          caption="Note: Solana buy-and-hold starts on its first valid observation (2020-04-10); Bitcoin and Ethereum start on 2016-11-09."
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

