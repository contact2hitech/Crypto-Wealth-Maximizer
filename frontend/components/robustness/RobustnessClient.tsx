"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertOctagon,
  Calendar,
  Compass,
  Layers,
  Play,
  RefreshCw,
  RotateCcw,
  Sliders,
} from "lucide-react";
import { ApiClientError, apiClient } from "@/lib/api";
import { RESEARCH_DISCLAIMERS } from "@/lib/constants/disclaimers";
import { REFERENCE_BACKTEST_CONFIG } from "@/lib/constants/referenceConfig";
import {
  formatInteger,
  formatPercent,
  formatRatio,
  formatUsd,
} from "@/lib/formatters/financial";
import type {
  AssetAttributionRow,
  RegimePerformanceRow,
  RobustnessAnalyzeRequest,
  RobustnessAnalyzeResponse,
  SensitivityRow,
  StrategyName,
  WalkForwardPeriodRow,
} from "@/types/api";
import { DataTable, type DataTableColumn } from "@/components/common/DataTable";
import { ErrorState } from "@/components/common/ErrorState";
import { PageHeader } from "@/components/common/PageHeader";
import { ResearchWarningBanner } from "@/components/common/ResearchWarningBanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STRATEGY_OPTIONS: StrategyName[] = [
  "A: 90-day momentum",
  "B: 50/200-day trend + momentum",
  "C: 30/90/180-day momentum",
];

const DD_STOP_OPTIONS = [5, 10, 15, 20, 25, 30, 40];

export function RobustnessClient() {
  // Config
  const [strategy, setStrategy] = useState<StrategyName>(REFERENCE_BACKTEST_CONFIG.strategy);
  const [ddProtection, setDdProtection] = useState<number>(REFERENCE_BACKTEST_CONFIG.drawdown_protection_pct);
  const [enableCashFilter, setEnableCashFilter] = useState<boolean>(REFERENCE_BACKTEST_CONFIG.enable_cash_filter);
  const [enableDdStop, setEnableDdStop] = useState<boolean>(REFERENCE_BACKTEST_CONFIG.enable_drawdown_protection);
  const [startDate, setStartDate] = useState<string>(REFERENCE_BACKTEST_CONFIG.start_date);
  const [endDate, setEndDate] = useState<string>(REFERENCE_BACKTEST_CONFIG.end_date ?? "2026-11-10");

  // State
  const [robustnessData, setRobustnessData] = useState<RobustnessAnalyzeResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);

  // Request Payload
  const currentPayload = useMemo<RobustnessAnalyzeRequest>(() => ({
    strategy,
    initial_capital: REFERENCE_BACKTEST_CONFIG.initial_capital,
    start_date: startDate,
    end_date: endDate,
    rebalance_frequency: REFERENCE_BACKTEST_CONFIG.rebalance_frequency,
    minimum_holding_days: REFERENCE_BACKTEST_CONFIG.minimum_holding_days,
    switching_threshold_pct: REFERENCE_BACKTEST_CONFIG.switching_threshold_pct,
    fee_bps_per_switch: REFERENCE_BACKTEST_CONFIG.fee_bps_per_switch,
    drawdown_protection_pct: ddProtection,
    cash_reentry_score_pct: REFERENCE_BACKTEST_CONFIG.cash_reentry_score_pct,
    initialization_mode: REFERENCE_BACKTEST_CONFIG.initialization_mode,
    enable_cash_filter: enableCashFilter,
    enable_drawdown_protection: enableDdStop,
    walk_forward_cash_filter: null,
    include_sensitivity: true,
  }), [strategy, ddProtection, enableCashFilter, enableDdStop, startDate, endDate]);

  // Execute Analysis
  const runAnalysis = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.analyzeRobustness(currentPayload, signal);
      setRobustnessData(res);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "REQUEST_ABORTED") return;
      setError({
        message: err instanceof Error ? err.message : "Failed to run robustness analysis.",
        code: err instanceof ApiClientError ? err.code : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [currentPayload]);

  // Reset
  const handleReset = useCallback(() => {
    setStrategy(REFERENCE_BACKTEST_CONFIG.strategy);
    setDdProtection(REFERENCE_BACKTEST_CONFIG.drawdown_protection_pct);
    setEnableCashFilter(REFERENCE_BACKTEST_CONFIG.enable_cash_filter);
    setEnableDdStop(REFERENCE_BACKTEST_CONFIG.enable_drawdown_protection);
    setStartDate(REFERENCE_BACKTEST_CONFIG.start_date);
    setEndDate(REFERENCE_BACKTEST_CONFIG.end_date ?? "2026-11-10");
  }, []);

  // Initial load
  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function fetchInitial() {
      try {
        const res = await apiClient.analyzeRobustness(
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
            enable_cash_filter: REFERENCE_BACKTEST_CONFIG.enable_cash_filter,
            enable_drawdown_protection: REFERENCE_BACKTEST_CONFIG.enable_drawdown_protection,
            walk_forward_cash_filter: null,
            include_sensitivity: true,
          },
          controller.signal
        );
        if (active) setRobustnessData(res);
      } catch (err) {
        if (active && !(err instanceof ApiClientError && err.code === "REQUEST_ABORTED")) {
          setError({
            message: err instanceof Error ? err.message : "Failed to run robustness analysis.",
            code: err instanceof ApiClientError ? err.code : undefined,
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    const timer = setTimeout(() => {
      void fetchInitial();
    }, 50);

    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, []);

  // Walk-Forward Columns
  const walkForwardColumns: DataTableColumn<WalkForwardPeriodRow>[] = [
    {
      key: "period",
      header: "Partition Period",
      render: (row) => {
        const isTest = row.period.toLowerCase().includes("test");
        return (
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">{row.period}</span>
            {isTest && (
              <Badge variant="outline" className="border-rose-500/40 bg-rose-500/10 text-rose-300 text-[10px]">
                Held-Out Out-of-Sample
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      key: "dates",
      header: "Window Range",
      render: (row) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.start_date} → {row.end_date}
        </span>
      ),
    },
    {
      key: "final_value_usd",
      header: "Final Value",
      numeric: true,
      render: (row) => (
        <span className="font-mono font-medium tabular-nums text-foreground">
          {formatUsd(row.final_value_usd)}
        </span>
      ),
    },
    {
      key: "total_return_pct",
      header: "Total Return",
      numeric: true,
      render: (row) => {
        const val = row.total_return_pct ?? 0;
        return (
          <span className={`font-mono tabular-nums ${val >= 0 ? "text-emerald-400" : "text-rose-400 font-semibold"}`}>
            {formatPercent(row.total_return_pct)}
          </span>
        );
      },
    },
    {
      key: "cagr_pct",
      header: "CAGR",
      numeric: true,
      render: (row) => {
        const val = row.cagr_pct ?? 0;
        return (
          <span className={`font-mono tabular-nums font-semibold ${val >= 0 ? "text-foreground" : "text-rose-400"}`}>
            {formatPercent(row.cagr_pct)}
          </span>
        );
      },
    },
    {
      key: "maximum_drawdown_pct",
      header: "Max Drawdown",
      numeric: true,
      render: (row) => (
        <span className="font-mono tabular-nums text-rose-400">
          {formatPercent(row.maximum_drawdown_pct)}
        </span>
      ),
    },
    {
      key: "annualized_volatility_pct",
      header: "Volatility",
      numeric: true,
      render: (row) => (
        <span className="font-mono tabular-nums text-muted-foreground">
          {formatPercent(row.annualized_volatility_pct)}
        </span>
      ),
    },
    {
      key: "sharpe_rf0",
      header: "Sharpe (rf=0)",
      numeric: true,
      render: (row) => {
        const val = row.sharpe_rf0 ?? 0;
        return (
          <span className={`font-mono tabular-nums ${val < 0 ? "text-rose-400" : "text-foreground"}`}>
            {formatRatio(row.sharpe_rf0)}
          </span>
        );
      },
    },
    {
      key: "switches",
      header: "Switches",
      numeric: true,
      render: (row) => (
        <span className="font-mono tabular-nums text-muted-foreground">
          {formatInteger(row.switches)}
        </span>
      ),
    },
    {
      key: "cash_days",
      header: "Cash Days",
      numeric: true,
      render: (row) => (
        <span className="font-mono tabular-nums text-muted-foreground">
          {formatInteger(row.cash_days)}
        </span>
      ),
    },
  ];

  // Regime Columns
  const regimeColumns: DataTableColumn<RegimePerformanceRow>[] = [
    {
      key: "market_regime",
      header: "Causal BTC Market Regime",
      render: (row) => (
        <div className="flex items-center gap-2">
          <Compass className="h-3.5 w-3.5 text-sky-400" />
          <span className="font-medium text-foreground">{row.market_regime}</span>
        </div>
      ),
    },
    {
      key: "days",
      header: "Days in Regime",
      numeric: true,
      render: (row) => (
        <span className="font-mono tabular-nums text-foreground">
          {formatInteger(row.days)}
        </span>
      ),
    },
    {
      key: "portfolio_return_in_regime_pct",
      header: "Portfolio Return in Regime",
      numeric: true,
      render: (row) => {
        const val = row.portfolio_return_in_regime_pct ?? 0;
        return (
          <span className={`font-mono tabular-nums font-semibold ${val >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {formatPercent(row.portfolio_return_in_regime_pct)}
          </span>
        );
      },
    },
    {
      key: "average_daily_return_pct",
      header: "Average Daily Return",
      numeric: true,
      render: (row) => {
        const val = row.average_daily_return_pct ?? 0;
        return (
          <span className={`font-mono tabular-nums ${val >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {formatPercent(row.average_daily_return_pct)}
          </span>
        );
      },
    },
    {
      key: "positive_days_pct",
      header: "Positive Days (%)",
      numeric: true,
      render: (row) => (
        <span className="font-mono tabular-nums text-muted-foreground">
          {formatPercent(row.positive_days_pct)}
        </span>
      ),
    },
    {
      key: "cash_days",
      header: "Cash Days in Regime",
      numeric: true,
      render: (row) => (
        <span className="font-mono tabular-nums text-muted-foreground">
          {formatInteger(row.cash_days)}
        </span>
      ),
    },
  ];

  // Asset Attribution Columns
  const attributionColumns: DataTableColumn<AssetAttributionRow>[] = [
    {
      key: "holding",
      header: "Asset / Cash Holding",
      render: (row) => (
        <Badge
          variant="outline"
          className={
            row.holding === "USD Cash"
              ? "border-amber-500/40 bg-amber-500/10 text-amber-300 font-mono text-xs"
              : "border-sky-500/40 bg-sky-500/10 text-sky-300 font-mono text-xs"
          }
        >
          {row.holding}
        </Badge>
      ),
    },
    {
      key: "days_held",
      header: "Days Held",
      numeric: true,
      render: (row) => (
        <span className="font-mono tabular-nums text-foreground">
          {formatInteger(row.days_held)}
        </span>
      ),
    },
    {
      key: "exposure_pct",
      header: "Time Exposure (%)",
      numeric: true,
      render: (row) => (
        <span className="font-mono font-medium tabular-nums text-foreground">
          {formatPercent(row.exposure_pct)}
        </span>
      ),
    },
    {
      key: "compounded_return_during_holding_days_pct",
      header: "Compounded Return",
      numeric: true,
      render: (row) => {
        const val = row.compounded_return_during_holding_days_pct ?? 0;
        return (
          <span className={`font-mono tabular-nums font-semibold ${val >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {formatPercent(row.compounded_return_during_holding_days_pct)}
          </span>
        );
      },
    },
    {
      key: "sum_of_daily_portfolio_returns_pct",
      header: "Sum of Daily Returns",
      numeric: true,
      render: (row) => (
        <span className="font-mono tabular-nums text-muted-foreground">
          {formatPercent(row.sum_of_daily_portfolio_returns_pct)}
        </span>
      ),
    },
    {
      key: "positive_holding_days_pct",
      header: "Win Rate Days (%)",
      numeric: true,
      render: (row) => (
        <span className="font-mono tabular-nums text-muted-foreground">
          {formatPercent(row.positive_holding_days_pct)}
        </span>
      ),
    },
  ];

  // Sensitivity Columns
  const sensitivityColumns: DataTableColumn<SensitivityRow>[] = [
    {
      key: "sensitivity_strategy",
      header: "Strategy",
      render: (row) => <span className="font-medium text-foreground">{row.sensitivity_strategy}</span>,
    },
    {
      key: "drawdown_trigger_pct",
      header: "DD Trigger Stop",
      render: (row) => (
        <Badge variant="outline" className="border-border bg-secondary font-mono text-xs">
          {row.drawdown_trigger_pct}%
        </Badge>
      ),
    },
    {
      key: "final_value_usd",
      header: "Final Value (USD)",
      numeric: true,
      render: (row) => (
        <span className="font-mono tabular-nums font-medium text-foreground">
          {formatUsd(row.final_value_usd)}
        </span>
      ),
    },
    {
      key: "total_return_pct",
      header: "Total Return",
      numeric: true,
      render: (row) => (
        <span className="font-mono tabular-nums text-emerald-400">
          {formatPercent(row.total_return_pct)}
        </span>
      ),
    },
    {
      key: "cagr_pct",
      header: "CAGR",
      numeric: true,
      render: (row) => (
        <span className="font-mono tabular-nums font-semibold text-foreground">
          {formatPercent(row.cagr_pct)}
        </span>
      ),
    },
    {
      key: "maximum_drawdown_pct",
      header: "Max Drawdown",
      numeric: true,
      render: (row) => (
        <span className="font-mono tabular-nums text-rose-400">
          {formatPercent(row.maximum_drawdown_pct)}
        </span>
      ),
    },
    {
      key: "sharpe_rf0",
      header: "Sharpe (rf=0)",
      numeric: true,
      render: (row) => (
        <span className="font-mono tabular-nums text-foreground">
          {formatRatio(row.sharpe_rf0)}
        </span>
      ),
    },
    {
      key: "switches",
      header: "Switches",
      numeric: true,
      render: (row) => (
        <span className="font-mono tabular-nums text-muted-foreground">
          {formatInteger(row.switches)}
        </span>
      ),
    },
    {
      key: "cash_days",
      header: "Cash Days",
      numeric: true,
      render: (row) => (
        <span className="font-mono tabular-nums text-muted-foreground">
          {formatInteger(row.cash_days)}
        </span>
      ),
    },
  ];

  const devPeriod = useMemo(
    () => robustnessData?.walk_forward?.periods?.find((p) => p.period.toLowerCase().includes("development")),
    [robustnessData]
  );
  const valPeriod = useMemo(
    () => robustnessData?.walk_forward?.periods?.find((p) => p.period.toLowerCase().includes("validation")),
    [robustnessData]
  );
  const testPeriod = useMemo(
    () => robustnessData?.walk_forward?.periods?.find((p) => p.period.toLowerCase().includes("test")),
    [robustnessData]
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Robustness & Walk-Forward Research"
        description="Independent Development, Validation, and Test period evaluations, causal Bitcoin market regimes, asset exposure attribution, and predeclared parameter sensitivity."
        badge="Phase 4 Active"
      />

      {/* Configuration Bar */}
      <Card className="border-border/80 bg-card/90 shadow-none">
        <CardHeader className="border-b border-border/60 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Sliders className="h-4 w-4 text-sky-400" />
              <span>Robustness Configuration &amp; Sensitivity Settings</span>
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
                <span>Run Robustness Analysis</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {/* Strategy */}
            <div className="space-y-1.5">
              <label htmlFor="robustness-strat-select" className="text-muted-foreground font-medium">
                Evaluated Strategy
              </label>
              <select
                id="robustness-strat-select"
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

            {/* DD Stop */}
            <div className="space-y-1.5">
              <label htmlFor="robustness-dd-select" className="text-muted-foreground font-medium">
                Drawdown Stop (%)
              </label>
              <select
                id="robustness-dd-select"
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

            {/* Cash Filter */}
            <div className="space-y-1.5">
              <span className="text-muted-foreground font-medium">Cash Filter</span>
              <div className="flex items-center gap-2 pt-1.5">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableCashFilter}
                    onChange={(e) => setEnableCashFilter(e.target.checked)}
                    className="rounded border-border text-sky-500 focus:ring-sky-500"
                  />
                  <span>Cash Filter Enabled</span>
                </label>
              </div>
            </div>

            {/* DD Stop Enabled */}
            <div className="space-y-1.5">
              <span className="text-muted-foreground font-medium">Drawdown Stop</span>
              <div className="flex items-center gap-2 pt-1.5">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableDdStop}
                    onChange={(e) => setEnableDdStop(e.target.checked)}
                    className="rounded border-border text-sky-500 focus:ring-sky-500"
                  />
                  <span>DD Protection Stop Enabled</span>
                </label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Walk-Forward Test Period Honesty Banner: Neutral loading skeleton vs Live Backend Data */}
      {loading && !robustnessData && (
        <div className="rounded-lg border border-border bg-card/60 p-4 text-xs text-muted-foreground animate-pulse">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
            <span>Loading walk-forward out-of-sample research metrics for {strategy}...</span>
          </div>
        </div>
      )}

      {robustnessData && testPeriod && (
        <div className="rounded-lg border-2 border-rose-500/80 bg-rose-500/10 p-4 text-xs text-rose-200">
          <div className="flex items-start gap-3">
            <AlertOctagon className="h-6 w-6 shrink-0 text-rose-400 mt-0.5" />
            <div className="space-y-1.5 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-sm text-rose-300 uppercase tracking-wide">
                  Strict Research Honesty: Out-of-Sample Test Period Deterioration
                </p>
                <Badge variant="outline" className="border-rose-400/30 text-rose-300 font-mono text-[10px]">
                  Configuration: {robustnessData.configuration.strategy} ({robustnessData.configuration.drawdown_protection_pct}% Stop)
                </Badge>
              </div>
              <p className="leading-relaxed text-rose-100/90 font-medium">
                In the held-out out-of-sample Test window (<strong>{testPeriod.start_date} → {testPeriod.end_date}</strong>), strategy performance evaluated on fixed unadjusted parameters experienced severe deterioration:
                CAGR dropped to{" "}
                <span className="font-mono font-bold text-rose-300">
                  {testPeriod.cagr_pct !== null ? formatPercent(testPeriod.cagr_pct) : "—"}
                </span>{" "}
                (Total Return:{" "}
                <span className="font-mono font-bold text-rose-300">
                  {testPeriod.total_return_pct !== null ? formatPercent(testPeriod.total_return_pct) : "—"}
                </span>
                ) and Sharpe fell to{" "}
                <span className="font-mono font-bold text-rose-300">
                  {testPeriod.sharpe_rf0 !== null ? formatRatio(testPeriod.sharpe_rf0) : "—"}
                </span>
                {devPeriod?.cagr_pct !== null && devPeriod?.cagr_pct !== undefined ? (
                  <>
                    , in contrast to in-sample Development ({formatPercent(devPeriod.cagr_pct)} CAGR) and Validation ({formatPercent(valPeriod?.cagr_pct ?? 0)} CAGR) periods
                  </>
                ) : null}
                .
              </p>
              <p className="text-[11px] text-rose-300/80 pt-0.5">
                The research methodology maintains fixed, unadjusted partition boundaries (Development 2016–2022, Validation 2023–2024, Test 2025–2026) to prevent selection bias, retrospective curve-fitting, and look-ahead data snooping.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <ErrorState
          title="Robustness Analysis Error"
          message={error.message}
          onRetry={() => void runAnalysis()}
        />
      )}

      {/* 1. Walk-Forward Independent Validation Section */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Calendar className="h-4 w-4 text-sky-400" />
            <span>Walk-Forward Independent Period Validation (Full Canonical Dataset)</span>
          </h2>
          <span className="text-xs text-muted-foreground font-mono">
            Fresh $1,480 capital in each independent period
          </span>
        </div>

        {/* Walk-Forward Table */}
        <DataTable
          columns={walkForwardColumns}
          rows={robustnessData?.walk_forward?.periods ?? []}
          getRowKey={(row) => row.period}
          loading={loading && !robustnessData}
          emptyTitle="No walk-forward analysis loaded"
          emptyDescription="Execute the robustness analysis to compute independent period outcomes."
        />
      </section>

      {/* 2. Causal Bitcoin Market Regimes Section */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Compass className="h-4 w-4 text-sky-400" />
            <span>Causal Bitcoin Market Regime Performance</span>
          </h2>
          <span className="text-xs text-muted-foreground font-mono">
            Classified causally via 200-day SMA &amp; slope
          </span>
        </div>
        <DataTable
          columns={regimeColumns}
          rows={robustnessData?.market_regimes ?? []}
          getRowKey={(row) => row.market_regime}
          loading={loading && !robustnessData}
          emptyTitle="No regime analysis loaded"
          emptyDescription="Execute robustness analysis to group returns by Bitcoin market regime."
        />
      </section>

      {/* 3. Asset Attribution Section */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Layers className="h-4 w-4 text-sky-400" />
            <span>Asset Exposure &amp; Return Attribution</span>
          </h2>
          <span className="text-xs text-muted-foreground font-mono">
            Compounded return during holding intervals
          </span>
        </div>
        <DataTable
          columns={attributionColumns}
          rows={robustnessData?.asset_attribution ?? []}
          getRowKey={(row) => row.holding}
          loading={loading && !robustnessData}
          emptyTitle="No asset attribution loaded"
          emptyDescription="Execute robustness analysis to inspect asset exposure breakdown."
        />
      </section>

      {/* 4. Predeclared 3x3 Parameter Sensitivity Grid */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Sliders className="h-4 w-4 text-sky-400" />
            <span>Predeclared 3×3 Parameter Sensitivity Grid</span>
          </h2>
          <span className="text-xs text-muted-foreground font-mono">
            3 Strategies (A, B, C) × 3 Drawdown Stops (15%, 20%, 25%)
          </span>
        </div>
        <DataTable
          columns={sensitivityColumns}
          rows={robustnessData?.parameter_sensitivity ?? []}
          getRowKey={(row) => `${row.sensitivity_strategy}-${row.drawdown_trigger_pct}`}
          loading={loading && !robustnessData}
          emptyTitle="No sensitivity grid loaded"
          emptyDescription="Run robustness analysis to compute the 3x3 parameter sensitivity grid."
        />
      </section>

      {/* Research Disclosures */}
      <ResearchWarningBanner
        title="Robustness & Methodology Disclosures"
        items={
          robustnessData?.limitations ?? [
            RESEARCH_DISCLAIMERS.walkForwardCaveat,
            RESEARCH_DISCLAIMERS.globalBanner,
          ]
        }
      />
    </div>
  );
}
