"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  Coins,
  DollarSign,
  Flame,
  Layers,
  Percent,
  Play,
  RefreshCw,
  RotateCcw,
  Shield,
  ShieldAlert,
  Sliders,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
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
import {
  buildComparisonRows,
  type ComparisonTableRow,
} from "@/lib/formatters/benchmarkComparisons";
import type {
  ConstrainedBacktestRequest,
  ConstrainedBacktestResponse,
  ConstrainedTradeRow,
  HindsightOptimizerResponse,
  HindsightSummaryRow,
  InitializationMode,
  PracticalBacktestResponse,
  PracticalSummaryRow,
  ProtectionCompareResponse,
  ProtectionCompareRow,
  RebalanceFrequency,
  StrategyName,
} from "@/types/api";
import { ChartContainer } from "@/components/charts/ChartContainer";
import { ClientChartFrame } from "@/components/charts/ClientChartFrame";
import {
  dateToUtcTimestamp,
  formatAxisTimestamp,
  formatCompactUsdAxis,
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

type LabTab = "backtest" | "compare" | "practical" | "hindsight";

interface EquityChartRow {
  date: string;
  timestamp: number;
  strategy: number | null;
  bitcoin: number | null;
  ethereum: number | null;
  solana: number | null;
}

interface MultiModeEquityRow {
  date: string;
  timestamp: number;
  [key: string]: number | string | null;
}

const STRATEGY_OPTIONS: StrategyName[] = [
  "A: 90-day momentum",
  "B: 50/200-day trend + momentum",
  "C: 30/90/180-day momentum",
];

const INITIALIZATION_OPTIONS: InitializationMode[] = [
  "Invest immediately in Bitcoin",
  "Wait for first valid signal",
];

const REBALANCE_OPTIONS: RebalanceFrequency[] = [
  "Monthly",
  "Every 15 days",
  "Weekly",
  "Daily",
];

const MIN_HOLD_OPTIONS = [0, 7, 14, 30, 60];
const SWITCH_THRESHOLD_OPTIONS = [0, 1, 3, 5, 10, 15, 20];
const FEE_BPS_OPTIONS = [0, 5, 10, 25, 50, 100];
const DD_STOP_OPTIONS = [5, 10, 15, 20, 25, 30, 40];
const RECOVERY_SCORE_OPTIONS = [-5, 0, 2, 5, 10];

const MODE_COLORS: Record<string, string> = {
  "Mode A: No Protection": "#94a3b8",
  "Mode B: Cash Filter Only": "#38bdf8",
  "Mode C: Drawdown Stop Only": "#f59e0b",
  "Mode D: Combined Protection": "#10b981",
  "Buy & hold: Bitcoin": "#f59e0b",
  "Buy & hold: Ethereum": "#a855f7",
  "Buy & hold: Solana": "#06b6d4",
};

export function StrategyLabClient() {
  // Active Tab
  const [activeTab, setActiveTab] = useState<LabTab>("backtest");

  // Configuration Form State (initialized to reference config)
  const [strategy, setStrategy] = useState<StrategyName>(REFERENCE_BACKTEST_CONFIG.strategy);
  const [initMode, setInitMode] = useState<InitializationMode>(REFERENCE_BACKTEST_CONFIG.initialization_mode);
  const [rebalanceFreq, setRebalanceFreq] = useState<RebalanceFrequency>(REFERENCE_BACKTEST_CONFIG.rebalance_frequency);
  const [minHoldDays, setMinHoldDays] = useState<number>(REFERENCE_BACKTEST_CONFIG.minimum_holding_days);
  const [switchThreshold, setSwitchThreshold] = useState<number>(REFERENCE_BACKTEST_CONFIG.switching_threshold_pct);
  const [feeBps, setFeeBps] = useState<number>(REFERENCE_BACKTEST_CONFIG.fee_bps_per_switch);
  const [ddProtection, setDdProtection] = useState<number>(REFERENCE_BACKTEST_CONFIG.drawdown_protection_pct);
  const [recoveryScore, setRecoveryScore] = useState<number>(REFERENCE_BACKTEST_CONFIG.cash_reentry_score_pct);
  const [initialCapital, setInitialCapital] = useState<number>(REFERENCE_BACKTEST_CONFIG.initial_capital);
  const [startDate, setStartDate] = useState<string>(REFERENCE_BACKTEST_CONFIG.start_date);
  const [endDate, setEndDate] = useState<string>(REFERENCE_BACKTEST_CONFIG.end_date ?? "2026-11-10");
  const [enableCashFilter, setEnableCashFilter] = useState<boolean>(REFERENCE_BACKTEST_CONFIG.enable_cash_filter);
  const [enableDdStop, setEnableDdStop] = useState<boolean>(REFERENCE_BACKTEST_CONFIG.enable_drawdown_protection);

  // Result States
  const [backtestRes, setBacktestRes] = useState<ConstrainedBacktestResponse | null>(null);
  const [compareRes, setCompareRes] = useState<ProtectionCompareResponse | null>(null);
  const [practicalRes, setPracticalRes] = useState<PracticalBacktestResponse | null>(null);
  const [hindsightRes, setHindsightRes] = useState<HindsightOptimizerResponse | null>(null);

  // Loading & Error States
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [equityScale, setEquityScale] = useState<"linear" | "log">("log");

  // Construct current request payload
  const currentBacktestPayload = useMemo<ConstrainedBacktestRequest>(() => ({
    strategy,
    initialization_mode: initMode,
    rebalance_frequency: rebalanceFreq,
    minimum_holding_days: minHoldDays,
    switching_threshold_pct: switchThreshold,
    fee_bps_per_switch: feeBps,
    drawdown_protection_pct: ddProtection,
    cash_reentry_score_pct: recoveryScore,
    initial_capital: initialCapital,
    start_date: startDate,
    end_date: endDate,
    allow_cash: true,
    enable_cash_filter: enableCashFilter,
    enable_drawdown_protection: enableDdStop,
    include_benchmarks: true,
    include_daily_trace: false,
  }), [
    strategy,
    initMode,
    rebalanceFreq,
    minHoldDays,
    switchThreshold,
    feeBps,
    ddProtection,
    recoveryScore,
    initialCapital,
    startDate,
    endDate,
    enableCashFilter,
    enableDdStop,
  ]);

  // Form Validation
  const validateForm = useCallback((): boolean => {
    if (startDate > endDate) {
      setValidationError("Start date must be earlier than or equal to end date.");
      return false;
    }
    if (initialCapital <= 0 || Number.isNaN(initialCapital)) {
      setValidationError("Initial capital must be a positive number.");
      return false;
    }
    setValidationError(null);
    return true;
  }, [startDate, endDate, initialCapital]);

  // Execution: Run Constrained Backtest
  const runBacktest = useCallback(async (signal?: AbortSignal) => {
    if (!validateForm()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.runConstrainedBacktest(currentBacktestPayload, signal);
      setBacktestRes(res);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "REQUEST_ABORTED") return;
      setError({
        message: err instanceof Error ? err.message : "Failed to run constrained backtest.",
        code: err instanceof ApiClientError ? err.code : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [currentBacktestPayload, validateForm]);

  // Execution: Run Protection Mode Comparison
  const runCompare = useCallback(async (signal?: AbortSignal) => {
    if (!validateForm()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.compareProtectionModes(
        {
          strategy,
          initialization_mode: initMode,
          rebalance_frequency: rebalanceFreq,
          minimum_holding_days: minHoldDays,
          switching_threshold_pct: switchThreshold,
          fee_bps_per_switch: feeBps,
          drawdown_protection_pct: ddProtection,
          cash_reentry_score_pct: recoveryScore,
          initial_capital: initialCapital,
          start_date: startDate,
          end_date: endDate,
          include_curves: true,
          include_details: true,
        },
        signal
      );
      setCompareRes(res);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "REQUEST_ABORTED") return;
      setError({
        message: err instanceof Error ? err.message : "Failed to run protection comparison.",
        code: err instanceof ApiClientError ? err.code : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [
    strategy,
    initMode,
    rebalanceFreq,
    minHoldDays,
    switchThreshold,
    feeBps,
    ddProtection,
    recoveryScore,
    initialCapital,
    startDate,
    endDate,
    validateForm,
  ]);

  // Execution: Run Practical Strategies
  const runPractical = useCallback(async (signal?: AbortSignal) => {
    if (!validateForm()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.runPracticalStrategies(
        {
          initial_capital: initialCapital,
          start_date: startDate,
          end_date: endDate,
          fee_bps_per_switch: feeBps,
        },
        signal
      );
      setPracticalRes(res);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "REQUEST_ABORTED") return;
      setError({
        message: err instanceof Error ? err.message : "Failed to run practical baseline strategies.",
        code: err instanceof ApiClientError ? err.code : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [initialCapital, startDate, endDate, feeBps, validateForm]);

  // Execution: Run Hindsight Optimizer
  const runHindsight = useCallback(async (signal?: AbortSignal) => {
    if (!validateForm()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.runHindsightOptimizer(
        {
          initial_capital: initialCapital,
          start_date: startDate,
          end_date: endDate,
          max_switches: 5,
        },
        signal
      );
      setHindsightRes(res);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "REQUEST_ABORTED") return;
      setError({
        message: err instanceof Error ? err.message : "Failed to run perfect hindsight optimizer.",
        code: err instanceof ApiClientError ? err.code : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [initialCapital, startDate, endDate, validateForm]);

  // Reset to reference config
  const handleReset = useCallback(() => {
    setStrategy(REFERENCE_BACKTEST_CONFIG.strategy);
    setInitMode(REFERENCE_BACKTEST_CONFIG.initialization_mode);
    setRebalanceFreq(REFERENCE_BACKTEST_CONFIG.rebalance_frequency);
    setMinHoldDays(REFERENCE_BACKTEST_CONFIG.minimum_holding_days);
    setSwitchThreshold(REFERENCE_BACKTEST_CONFIG.switching_threshold_pct);
    setFeeBps(REFERENCE_BACKTEST_CONFIG.fee_bps_per_switch);
    setDdProtection(REFERENCE_BACKTEST_CONFIG.drawdown_protection_pct);
    setRecoveryScore(REFERENCE_BACKTEST_CONFIG.cash_reentry_score_pct);
    setInitialCapital(REFERENCE_BACKTEST_CONFIG.initial_capital);
    setStartDate(REFERENCE_BACKTEST_CONFIG.start_date);
    setEndDate(REFERENCE_BACKTEST_CONFIG.end_date ?? "2026-11-10");
    setEnableCashFilter(REFERENCE_BACKTEST_CONFIG.enable_cash_filter);
    setEnableDdStop(REFERENCE_BACKTEST_CONFIG.enable_drawdown_protection);
    setValidationError(null);
  }, []);

  // Initial load on mount
  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function fetchInitial() {
      try {
        const res = await apiClient.runConstrainedBacktest(
          REFERENCE_BACKTEST_CONFIG,
          controller.signal
        );
        if (active) setBacktestRes(res);
      } catch (err) {
        if (active && !(err instanceof ApiClientError && err.code === "REQUEST_ABORTED")) {
          setError({
            message: err instanceof Error ? err.message : "Failed to run constrained backtest.",
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

  // Handle Tab Change with lazy loading
  const handleTabChange = useCallback((tab: LabTab) => {
    setActiveTab(tab);
    if (tab === "compare" && !compareRes) {
      void runCompare();
    } else if (tab === "practical" && !practicalRes) {
      void runPractical();
    } else if (tab === "hindsight" && !hindsightRes) {
      void runHindsight();
    }
  }, [compareRes, practicalRes, hindsightRes, runCompare, runPractical, runHindsight]);

  // Downsampled Primary Equity Chart Data
  const primaryEquityData = useMemo<EquityChartRow[]>(() => {
    if (!backtestRes) return [];
    const btcMap = new Map((backtestRes.benchmark_curves.Bitcoin ?? []).map((p) => [p.date, p.value_usd]));
    const ethMap = new Map((backtestRes.benchmark_curves.Ethereum ?? []).map((p) => [p.date, p.value_usd]));
    const solMap = new Map((backtestRes.benchmark_curves.Solana ?? []).map((p) => [p.date, p.value_usd]));

    const merged: EquityChartRow[] = backtestRes.equity_curve.map((pt) => ({
      date: pt.date,
      timestamp: dateToUtcTimestamp(pt.date),
      strategy: pt.value_usd,
      bitcoin: btcMap.get(pt.date) ?? null,
      ethereum: ethMap.get(pt.date) ?? null,
      solana: solMap.get(pt.date) ?? null,
    }));

    return downsampleByExtrema(merged, 450, (row) => [
      row.strategy,
      row.bitcoin,
      row.ethereum,
      row.solana,
    ]);
  }, [backtestRes]);

  // Downsampled Multi-Mode Comparison Chart Data
  const compareChartData = useMemo<MultiModeEquityRow[]>(() => {
    if (!compareRes || !compareRes.curves) return [];
    const curveKeys = Object.keys(compareRes.curves);
    if (curveKeys.length === 0) return [];

    const firstKey = curveKeys[0];
    const dates = compareRes.curves[firstKey].map((p) => p.date);
    const maps = new Map<string, Map<string, number | null>>();
    for (const key of curveKeys) {
      maps.set(key, new Map(compareRes.curves[key].map((p) => [p.date, p.value_usd])));
    }

    const merged: MultiModeEquityRow[] = dates.map((d) => {
      const row: MultiModeEquityRow = { date: d, timestamp: dateToUtcTimestamp(d) };
      for (const key of curveKeys) {
        row[key] = maps.get(key)?.get(d) ?? null;
      }
      return row;
    });

    return downsampleByExtrema(merged, 450, (row) =>
      curveKeys.map((k) => (typeof row[k] === "number" ? (row[k] as number) : null))
    );
  }, [compareRes]);

  // Downsampled Practical Baseline Chart Data
  const practicalChartData = useMemo<MultiModeEquityRow[]>(() => {
    if (!practicalRes || !practicalRes.equity_curves) return [];
    const keys = Object.keys(practicalRes.equity_curves);
    if (keys.length === 0) return [];

    const firstKey = keys[0];
    const dates = practicalRes.equity_curves[firstKey].map((p) => p.date);
    const maps = new Map<string, Map<string, number | null>>();
    for (const key of keys) {
      maps.set(key, new Map(practicalRes.equity_curves[key].map((p) => [p.date, p.value_usd])));
    }

    const merged: MultiModeEquityRow[] = dates.map((d) => {
      const row: MultiModeEquityRow = { date: d, timestamp: dateToUtcTimestamp(d) };
      for (const key of keys) {
        row[key] = maps.get(key)?.get(d) ?? null;
      }
      return row;
    });

    return downsampleByExtrema(merged, 450, (row) =>
      keys.map((k) => (typeof row[k] === "number" ? (row[k] as number) : null))
    );
  }, [practicalRes]);

  // Benchmark rows for primary backtest
  const comparisonRows = useMemo<ComparisonTableRow[]>(() => {
    if (!backtestRes) return [];
    return buildComparisonRows(backtestRes);
  }, [backtestRes]);

  // Table Columns Definitions
  const comparisonColumns: DataTableColumn<ComparisonTableRow>[] = [
    {
      key: "label",
      header: "Strategy / Benchmark",
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{row.label}</span>
          {row.is_partial && (
            <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-300 text-[10px]">
              *Partial Window
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "period_label",
      header: "Evaluation Period",
      render: (row) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.period_label} ({row.horizon_years})
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
        <span className="font-mono tabular-nums text-foreground font-semibold">
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

  const tradeColumns: DataTableColumn<ConstrainedTradeRow>[] = [
    {
      key: "signal_date",
      header: "Signal Date",
      render: (row) => <span className="font-mono text-xs">{row.signal_date}</span>,
    },
    {
      key: "signal_execution_date",
      header: "Execution Date",
      render: (row) => <span className="font-mono text-xs">{row.signal_execution_date}</span>,
    },
    {
      key: "from_asset",
      header: "From",
      render: (row) => (
        <Badge variant="outline" className="border-border bg-secondary/50 font-mono text-[11px]">
          {row.from_asset}
        </Badge>
      ),
    },
    {
      key: "to_asset",
      header: "To",
      render: (row) => (
        <Badge
          variant="outline"
          className={
            row.to_asset === "USD Cash"
              ? "border-amber-500/40 bg-amber-500/10 text-amber-300 font-mono text-[11px]"
              : "border-sky-500/40 bg-sky-500/10 text-sky-300 font-mono text-[11px]"
          }
        >
          {row.to_asset}
        </Badge>
      ),
    },
    {
      key: "reason",
      header: "Decision Reason",
      render: (row) => <span className="text-xs text-muted-foreground">{row.reason ?? "—"}</span>,
    },
    {
      key: "portfolio_value_after_fee_usd",
      header: "Value After Fee",
      numeric: true,
      render: (row) => (
        <span className="font-mono tabular-nums font-medium text-foreground">
          {formatUsd(row.portfolio_value_after_fee_usd)}
        </span>
      ),
    },
    {
      key: "drawdown_at_decision_pct",
      header: "DD at Decision",
      numeric: true,
      render: (row) => (
        <span className="font-mono tabular-nums text-rose-400">
          {formatPercent(row.drawdown_at_decision_pct)}
        </span>
      ),
    },
  ];

  const compareColumns: DataTableColumn<ProtectionCompareRow>[] = [
    {
      key: "experiment",
      header: "Mode / Experiment",
      render: (row) => <span className="font-medium text-foreground">{row.experiment}</span>,
    },
    {
      key: "final_value_usd",
      header: "Final Value (USD)",
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

  const practicalColumns: DataTableColumn<PracticalSummaryRow>[] = [
    {
      key: "strategy",
      header: "Strategy (No Lookahead)",
      render: (row) => <span className="font-medium text-foreground">{row.strategy}</span>,
    },
    {
      key: "final_value_usd",
      header: "Final Value (USD)",
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
      key: "sharpe_rf0_daily",
      header: "Sharpe (rf=0)",
      numeric: true,
      render: (row) => (
        <span className="font-mono tabular-nums text-foreground">
          {formatRatio(row.sharpe_rf0_daily)}
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
  ];

  const hindsightColumns: DataTableColumn<HindsightSummaryRow>[] = [
    {
      key: "maximum_switches",
      header: "Switch Cap (K)",
      render: (row) => (
        <Badge variant="outline" className="border-border bg-secondary font-mono text-xs">
          K = {row.maximum_switches}
        </Badge>
      ),
    },
    {
      key: "actual_switches",
      header: "Switches Made",
      numeric: true,
      render: (row) => (
        <span className="font-mono tabular-nums text-foreground">
          {row.actual_switches}
        </span>
      ),
    },
    {
      key: "final_value_usd",
      header: "Final Value (USD)",
      numeric: true,
      render: (row) => (
        <span className="font-mono font-bold tabular-nums text-amber-300">
          {formatUsd(row.final_value_usd)}
        </span>
      ),
    },
    {
      key: "return_pct",
      header: "Total Return",
      numeric: true,
      render: (row) => (
        <span className="font-mono tabular-nums text-emerald-400">
          {formatPercent(row.return_pct)}
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
      key: "ending_asset",
      header: "Ending Asset",
      render: (row) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.ending_asset}
        </span>
      ),
    },
  ];

  const summary = backtestRes?.summary;

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Strategy Lab"
        description="Interactive parameter experimentation, protection mode comparisons, practical no-lookahead baselines, and theoretical hindsight upper bounds."
        badge="Phase 4 Active"
      />

      {/* Main Interactive Form Card */}
      <Card className="border-border/80 bg-card/90 shadow-none">
        <CardHeader className="border-b border-border/60 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Sliders className="h-4 w-4 text-sky-400" />
              <span>Strategy &amp; Risk Parameters</span>
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
                onClick={() => {
                  if (activeTab === "backtest") void runBacktest();
                  else if (activeTab === "compare") void runCompare();
                  else if (activeTab === "practical") void runPractical();
                  else if (activeTab === "hindsight") void runHindsight();
                }}
                disabled={loading}
                className="gap-1.5 bg-sky-600 hover:bg-sky-500 text-white font-medium"
              >
                {loading ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5 fill-current" />
                )}
                <span>Run Experiment</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {/* Validation Alert */}
          {validationError && (
            <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-2.5 text-xs text-rose-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Grid of Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {/* Strategy Selection */}
            <div className="space-y-1.5">
              <label htmlFor="strategy-select" className="text-muted-foreground font-medium flex items-center gap-1">
                <span>Momentum Strategy</span>
              </label>
              <select
                id="strategy-select"
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

            {/* Initialization Mode */}
            <div className="space-y-1.5">
              <label htmlFor="init-mode-select" className="text-muted-foreground font-medium flex items-center gap-1">
                <span>Portfolio Initialization</span>
              </label>
              <select
                id="init-mode-select"
                value={initMode}
                onChange={(e) => setInitMode(e.target.value as InitializationMode)}
                className="w-full rounded-md border border-border bg-secondary/60 px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                {INITIALIZATION_OPTIONS.map((opt) => (
                  <option key={opt} value={opt} className="bg-popover text-popover-foreground">
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Rebalancing Frequency */}
            <div className="space-y-1.5">
              <label htmlFor="rebalance-select" className="text-muted-foreground font-medium flex items-center gap-1">
                <span>Rebalancing Frequency</span>
              </label>
              <select
                id="rebalance-select"
                value={rebalanceFreq}
                onChange={(e) => setRebalanceFreq(e.target.value as RebalanceFrequency)}
                className="w-full rounded-md border border-border bg-secondary/60 px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                {REBALANCE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt} className="bg-popover text-popover-foreground">
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Minimum Holding Days */}
            <div className="space-y-1.5">
              <label htmlFor="min-hold-select" className="text-muted-foreground font-medium flex items-center gap-1">
                <span>Minimum Holding Period</span>
              </label>
              <select
                id="min-hold-select"
                value={minHoldDays}
                onChange={(e) => setMinHoldDays(Number(e.target.value))}
                className="w-full rounded-md border border-border bg-secondary/60 px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                {MIN_HOLD_OPTIONS.map((opt) => (
                  <option key={opt} value={opt} className="bg-popover text-popover-foreground">
                    {opt} days
                  </option>
                ))}
              </select>
            </div>

            {/* Switching Threshold */}
            <div className="space-y-1.5">
              <label htmlFor="switch-thresh-select" className="text-muted-foreground font-medium flex items-center gap-1">
                <span>Switching Threshold (%)</span>
              </label>
              <select
                id="switch-thresh-select"
                value={switchThreshold}
                onChange={(e) => setSwitchThreshold(Number(e.target.value))}
                className="w-full rounded-md border border-border bg-secondary/60 px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                {SWITCH_THRESHOLD_OPTIONS.map((opt) => (
                  <option key={opt} value={opt} className="bg-popover text-popover-foreground">
                    {opt}%
                  </option>
                ))}
              </select>
            </div>

            {/* Transaction Cost (bps) */}
            <div className="space-y-1.5">
              <label htmlFor="fee-bps-select" className="text-muted-foreground font-medium flex items-center justify-between gap-1">
                <span>Transaction Fee (bps)</span>
                {activeTab === "hindsight" && (
                  <span className="text-[10px] text-amber-400 font-normal">
                    (Fee-Free in Hindsight)
                  </span>
                )}
              </label>
              <select
                id="fee-bps-select"
                value={feeBps}
                disabled={activeTab === "hindsight"}
                onChange={(e) => setFeeBps(Number(e.target.value))}
                className={`w-full rounded-md border border-border px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                  activeTab === "hindsight" ? "bg-muted/40 cursor-not-allowed opacity-60" : "bg-secondary/60"
                }`}
              >
                {FEE_BPS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt} className="bg-popover text-popover-foreground">
                    {opt} bps
                  </option>
                ))}
              </select>
            </div>

            {/* Drawdown Protection Stop */}
            <div className="space-y-1.5">
              <label htmlFor="dd-stop-select" className="text-muted-foreground font-medium flex items-center gap-1">
                <span>Drawdown Stop Trigger (%)</span>
              </label>
              <select
                id="dd-stop-select"
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

            {/* Cash Re-entry Recovery Score */}
            <div className="space-y-1.5">
              <label htmlFor="reentry-select" className="text-muted-foreground font-medium flex items-center gap-1">
                <span>Cash Re-entry Threshold (%)</span>
              </label>
              <select
                id="reentry-select"
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

            {/* Initial Capital */}
            <div className="space-y-1.5">
              <label htmlFor="initial-capital-input" className="text-muted-foreground font-medium flex items-center gap-1">
                <span>Initial Capital ($ USD)</span>
              </label>
              <input
                id="initial-capital-input"
                type="number"
                min={1}
                step={10}
                value={initialCapital}
                onChange={(e) => setInitialCapital(Number(e.target.value))}
                className="w-full rounded-md border border-border bg-secondary/60 px-2.5 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            {/* Start Date */}
            <div className="space-y-1.5">
              <label htmlFor="start-date-input" className="text-muted-foreground font-medium flex items-center gap-1">
                <span>Start Date</span>
              </label>
              <input
                id="start-date-input"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-md border border-border bg-secondary/60 px-2.5 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            {/* End Date */}
            <div className="space-y-1.5">
              <label htmlFor="end-date-input" className="text-muted-foreground font-medium flex items-center gap-1">
                <span>End Date</span>
              </label>
              <input
                id="end-date-input"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-md border border-border bg-secondary/60 px-2.5 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            {/* Protection Toggles */}
            <div className="space-y-1.5">
              <span className="text-muted-foreground font-medium">Protection Toggles</span>
              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableCashFilter}
                    onChange={(e) => setEnableCashFilter(e.target.checked)}
                    className="rounded border-border text-sky-500 focus:ring-sky-500"
                  />
                  <span>Cash Filter</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableDdStop}
                    onChange={(e) => setEnableDdStop(e.target.checked)}
                    className="rounded border-border text-sky-500 focus:ring-sky-500"
                  />
                  <span>DD Stop</span>
                </label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sub-Workflows & View Mode Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => handleTabChange("backtest")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${activeTab === "backtest"
              ? "bg-sky-500/15 text-sky-300 border border-sky-500/30"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            }`}
        >
          <TrendingUp className="h-3.5 w-3.5" />
          <span>Configured Strategy Backtest</span>
        </button>
        <button
          type="button"
          onClick={() => handleTabChange("compare")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${activeTab === "compare"
              ? "bg-sky-500/15 text-sky-300 border border-sky-500/30"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            }`}
        >
          <Shield className="h-3.5 w-3.5" />
          <span>4 Protection Modes Comparison</span>
        </button>
        <button
          type="button"
          onClick={() => handleTabChange("practical")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${activeTab === "practical"
              ? "bg-sky-500/15 text-sky-300 border border-sky-500/30"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            }`}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>Practical Strategies A / B / C</span>
        </button>
        <button
          type="button"
          onClick={() => handleTabChange("hindsight")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${activeTab === "hindsight"
              ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            }`}
        >
          <Flame className="h-3.5 w-3.5" />
          <span>Perfect-Hindsight Upper Bound</span>
        </button>
      </div>

      {/* Global Error Banner */}
      {error && (
        <ErrorState
          title="Backtest Simulation Error"
          message={error.message}
          onRetry={() => {
            if (activeTab === "backtest") void runBacktest();
            else if (activeTab === "compare") void runCompare();
            else if (activeTab === "practical") void runPractical();
            else if (activeTab === "hindsight") void runHindsight();
          }}
        />
      )}

      {/* TAB 1: CONFIGURED STRATEGY BACKTEST */}
      {activeTab === "backtest" && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            <MetricCard
              label="Initial Capital"
              value={summary ? formatUsd(summary.final_value_usd ? initialCapital : null) : null}
              sublabel="Starting capital"
              icon={<DollarSign className="h-4 w-4" />}
              loading={loading && !backtestRes}
            />
            <MetricCard
              label="Final Value"
              value={summary ? formatUsd(summary.final_value_usd) : null}
              sublabel="Simulated value"
              icon={<TrendingUp className="h-4 w-4" />}
              tone="positive"
              loading={loading && !backtestRes}
            />
            <MetricCard
              label="Total Return"
              value={summary ? formatPercent(summary.total_return_pct) : null}
              sublabel="Compounded return"
              icon={<Percent className="h-4 w-4" />}
              tone="positive"
              loading={loading && !backtestRes}
            />
            <MetricCard
              label="CAGR"
              value={summary ? formatPercent(summary.cagr_pct) : null}
              sublabel="Annualized return"
              icon={<TrendingUp className="h-4 w-4" />}
              tone="positive"
              loading={loading && !backtestRes}
            />
            <MetricCard
              label="Max Drawdown"
              value={summary ? formatPercent(summary.maximum_drawdown_pct) : null}
              sublabel="Peak-to-trough"
              icon={<TrendingDown className="h-4 w-4" />}
              tone="negative"
              loading={loading && !backtestRes}
            />
            <MetricCard
              label="Volatility"
              value={summary ? formatPercent(summary.annualized_volatility_pct) : null}
              sublabel="Annualized daily"
              icon={<Percent className="h-4 w-4" />}
              loading={loading && !backtestRes}
            />
            <MetricCard
              label="Sharpe (rf=0)"
              value={summary ? formatRatio(summary.sharpe_rf0) : null}
              sublabel="Risk-adjusted"
              icon={<Coins className="h-4 w-4" />}
              tone={summary && (summary.sharpe_rf0 ?? 0) > 1 ? "positive" : "neutral"}
              loading={loading && !backtestRes}
            />
            <MetricCard
              label="Switches / Cash"
              value={summary ? `${summary.switches} / ${summary.cash_days}d` : null}
              sublabel="Switches & cash days"
              icon={<ArrowRightLeft className="h-4 w-4" />}
              loading={loading && !backtestRes}
            />
          </section>

          {/* Recharts Equity Curve */}
          <ChartContainer
            title="Portfolio Equity Curve vs Buy-and-Hold Benchmarks (USD)"
            description="Daily simulated portfolio value compared against BTC, ETH, and SOL buy-and-hold benchmarks on a continuous numeric time scale."
            loading={loading && !backtestRes}
            error={error?.message ?? null}
            onRetry={() => void runBacktest()}
            isEmpty={!loading && !error && primaryEquityData.length === 0}
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
              backtestRes
                ? `Rendered ${formatInteger(primaryEquityData.length)} extrema-preserving chart points from ${formatInteger(backtestRes.equity_curve.length)} backend observations.`
                : undefined
            }
          >
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS.strategy }} />
                  <span className="text-foreground font-medium">Configured Strategy</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS.bitcoin }} />
                  <span>Bitcoin</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS.benchmark }} />
                  <span>Ethereum</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS.solana }} />
                  <span>Solana (from 2020-04-10)</span>
                </span>
              </div>
              <ClientChartFrame height={320}>
                <LineChart data={primaryEquityData} margin={{ top: 8, right: 12, left: 6, bottom: 4 }}>
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
                    formatter={(value) => [typeof value === "number" ? formatUsd(value) : "—"]}
                  />
                  <Line
                    type="linear"
                    dataKey="strategy"
                    name="Strategy"
                    stroke={CHART_COLORS.strategy}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="linear"
                    dataKey="bitcoin"
                    name="Bitcoin"
                    stroke={CHART_COLORS.bitcoin}
                    strokeWidth={1.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="linear"
                    dataKey="ethereum"
                    name="Ethereum"
                    stroke={CHART_COLORS.benchmark}
                    strokeWidth={1.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="linear"
                    dataKey="solana"
                    name="Solana"
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

          {/* Benchmark Table */}
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-foreground">
              Configured Strategy vs Buy-and-Hold Benchmarks
            </h2>
            <DataTable
              columns={comparisonColumns}
              rows={comparisonRows}
              getRowKey={(row) => row.key}
              loading={loading && !backtestRes}
              emptyTitle="No backtest loaded"
              emptyDescription="Run the backtest above to view comparative metrics."
            />
          </section>

          {/* Paginated Switch History */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-foreground">
                Position Switching History (Most Recent First)
              </h2>
              <span className="text-xs text-muted-foreground">
                {backtestRes ? `${backtestRes.trades.length} recorded switches` : ""}
              </span>
            </div>
            <DataTable
              columns={tradeColumns}
              rows={backtestRes ? [...backtestRes.trades].reverse() : []}
              getRowKey={(row, idx) => `${row.signal_date}-${row.from_asset}-${row.to_asset}-${idx}`}
              loading={loading && !backtestRes}
              pageSize={10}
              emptyTitle="No position switches recorded"
              emptyDescription="No switches occurred under the active parameter configuration."
            />
          </section>
        </div>
      )}

      {/* TAB 2: 4 PROTECTION MODES COMPARISON */}
      {activeTab === "compare" && (
        <div className="space-y-6">
          <ChartContainer
            title="Four Protection Modes vs Benchmarks"
            description="Comparing Mode A (No Protection), Mode B (Cash Filter Only), Mode C (Drawdown Stop Only), and Mode D (Combined Protection)."
            loading={loading && !compareRes}
            error={error?.message ?? null}
            onRetry={() => void runCompare()}
            isEmpty={!loading && !error && compareChartData.length === 0}
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
          >
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                {compareRes &&
                  Object.keys(compareRes.curves).map((key) => (
                    <span key={key} className="flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: MODE_COLORS[key] ?? "#94a3b8" }}
                      />
                      <span className="text-foreground">{key}</span>
                    </span>
                  ))}
              </div>
              <ClientChartFrame height={320}>
                <LineChart data={compareChartData} margin={{ top: 8, right: 12, left: 6, bottom: 4 }}>
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
                    formatter={(value) => [typeof value === "number" ? formatUsd(value) : "—"]}
                  />
                  {compareRes &&
                    Object.keys(compareRes.curves).map((key) => (
                      <Line
                        key={key}
                        type="linear"
                        dataKey={key}
                        name={key}
                        stroke={MODE_COLORS[key] ?? "#94a3b8"}
                        strokeWidth={key.includes("Combined") ? 2 : 1.25}
                        dot={false}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                    ))}
                </LineChart>
              </ClientChartFrame>
            </div>
          </ChartContainer>

          {/* 4-Mode Comparison Table */}
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-foreground">
              Protection Modes Summary Table (POST /api/backtest/compare)
            </h2>
            <DataTable
              columns={compareColumns}
              rows={compareRes?.comparison ?? []}
              getRowKey={(row) => row.experiment}
              loading={loading && !compareRes}
              emptyTitle="No protection comparison loaded"
              emptyDescription="Execute the comparison above to view 4-mode metrics."
            />
          </section>
        </div>
      )}

      {/* TAB 3: PRACTICAL BASELINE STRATEGIES A / B / C */}
      {activeTab === "practical" && (
        <div className="space-y-6">
          <ChartContainer
            title="Practical No-Lookahead Baseline Strategies"
            description="Comparing fully-invested Strategies A, B, and C against Bitcoin buy-and-hold without cash filter."
            loading={loading && !practicalRes}
            error={error?.message ?? null}
            onRetry={() => void runPractical()}
            isEmpty={!loading && !error && practicalChartData.length === 0}
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
          >
            <div className="space-y-3">
              <ClientChartFrame height={320}>
                <LineChart data={practicalChartData} margin={{ top: 8, right: 12, left: 6, bottom: 4 }}>
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
                    formatter={(value) => [typeof value === "number" ? formatUsd(value) : "—"]}
                  />
                  {practicalRes &&
                    Object.keys(practicalRes.equity_curves).map((key, idx) => {
                      const colors = ["#f59e0b", "#38bdf8", "#10b981", "#a855f7"];
                      return (
                        <Line
                          key={key}
                          type="linear"
                          dataKey={key}
                          name={key}
                          stroke={colors[idx % colors.length]}
                          strokeWidth={key.includes("Bitcoin") ? 1.5 : 2}
                          dot={false}
                          connectNulls={false}
                          isAnimationActive={false}
                        />
                      );
                    })}
                </LineChart>
              </ClientChartFrame>
            </div>
          </ChartContainer>

          {/* Practical Summary Table */}
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-foreground">
              Practical Strategy Baselines (strategy_engine.py)
            </h2>
            <DataTable
              columns={practicalColumns}
              rows={practicalRes?.summary ?? []}
              getRowKey={(row) => row.strategy}
              loading={loading && !practicalRes}
              emptyTitle="No practical strategies loaded"
              emptyDescription="Execute practical strategies baseline to view results."
            />
          </section>
        </div>
      )}

      {/* TAB 4: PERFECT HINDSIGHT UPPER BOUND */}
      {activeTab === "hindsight" && (
        <div className="space-y-6">
          {/* CRITICAL NON-INVESTABLE DISCLAIMER BANNER */}
          <div className="rounded-lg border-2 border-amber-500/80 bg-amber-500/15 p-4 text-xs text-amber-200">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-6 w-6 shrink-0 text-amber-400 mt-0.5" />
              <div className="space-y-1.5 flex-1">
                <p className="font-bold text-sm text-amber-300 uppercase tracking-wide">
                  PERFECT HINDSIGHT — NON-INVESTABLE UPPER BOUND
                </p>
                <p className="leading-relaxed text-amber-100/90 font-medium">
                  The dynamic-programming optimizer operates with 100% future price visibility across the entire evaluation horizon.
                  It represents a theoretical mathematical maximum achievable with up to K switches and cannot be achieved in live trading.
                  Never use these hindsight figures for financial expectations or investor materials.
                </p>
                <p className="text-[11px] text-amber-300/90 bg-amber-500/20 rounded p-2 border border-amber-500/30">
                  <strong>Fee &amp; Slippage Caveat:</strong> Theoretical hindsight dynamic programming operates strictly fee-free (0 bps transaction costs, zero taxes, and zero slippage). The strategy fee control does not apply to this calculation.
                </p>
                <div className="flex items-center gap-3 pt-1 text-[11px] text-amber-300 font-mono">
                  <span>is_hindsight_upper_bound: true</span>
                  <span>•</span>
                  <span>is_investable: false</span>
                </div>
              </div>
            </div>
          </div>

          {/* Hindsight Summary Table */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-foreground">
                Optimal Switching Path Reconstruction by Switch Cap (K = 0..5)
              </h2>
              <span className="text-xs text-muted-foreground font-mono">
                crypto_engine.optimal_switching
              </span>
            </div>
            <DataTable
              columns={hindsightColumns}
              rows={hindsightRes?.summary ?? []}
              getRowKey={(row) => `cap-${row.maximum_switches}`}
              loading={loading && !hindsightRes}
              emptyTitle="No hindsight results loaded"
              emptyDescription="Run the hindsight optimizer to compute dynamic programming upper bounds."
            />
          </section>
        </div>
      )}

      {/* Research Disclosures */}
      <ResearchWarningBanner
        title="Strategy Lab Research Limitations"
        items={[
          RESEARCH_DISCLAIMERS.globalBanner,
          RESEARCH_DISCLAIMERS.dailyStopCaveat,
          RESEARCH_DISCLAIMERS.hindsightWarning,
        ]}
      />
    </div>
  );
}
