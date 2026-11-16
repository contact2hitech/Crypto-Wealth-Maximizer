/**
 * Benchmark comparison formatting and row construction helpers.
 *
 * Ensures uniform evaluation horizon calculation and dynamic metadata extraction
 * across Dashboard and Strategy Lab comparison tables.
 */

import type { ConstrainedBacktestResponse } from "@/types/api";

export interface ComparisonTableRow {
  key: string;
  label: string;
  period_label: string;
  horizon_years: string;
  is_partial?: boolean;
  final_value_usd: number | null;
  total_return_pct: number | null;
  cagr_pct: number | null;
  maximum_drawdown_pct: number | null;
  annualized_volatility_pct: number | null;
  sharpe_rf0: number | null;
  switches: number;
  cash_days: number;
}

export interface BenchmarkComparabilityNoticeInfo {
  strategyHorizonYears: string;
  solanaHorizonYears: string;
  solanaStartDate: string;
  solanaCagrPct: number | null;
  fullStartDate: string;
  fullEndDate: string;
}

/**
 * Uniformly calculate elapsed calendar years between two ISO date strings (UTC midnight).
 * Returns a display string e.g. "10.0 yrs" or "6.6 yrs".
 */
export function calculateHorizonYears(startDate: string, endDate: string): string {
  const startMs = Date.parse(`${startDate}T00:00:00Z`);
  const endMs = Date.parse(`${endDate}T00:00:00Z`);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) {
    return "—";
  }
  const years = (endMs - startMs) / (86_400_000 * 365.25);
  return `${years.toFixed(1)} yrs`;
}

/**
 * Determine the canonical Solana dataset start date from backend metadata.
 * Prefers explicit argument, then benchmark curve first date, then fallback.
 */
export function resolveSolanaStartDate(
  backtest: Pick<ConstrainedBacktestResponse, "benchmark_curves">,
  overrideStartDate?: string | null
): string {
  if (overrideStartDate) return overrideStartDate;
  const firstSolPoint = backtest.benchmark_curves?.Solana?.[0]?.date;
  if (firstSolPoint) return firstSolPoint;
  return "2020-04-10";
}

/**
 * Build comparison table rows for the strategy and BTC/ETH/SOL benchmarks.
 * Uses uniform horizon calculation and dynamically detects Solana partial-window status.
 */
export function buildComparisonRows(
  backtest: Pick<
    ConstrainedBacktestResponse,
    "summary" | "benchmark_summaries" | "date_range" | "benchmark_curves"
  >,
  solanaStartDateOverride?: string | null
): ComparisonTableRow[] {
  const fullStart = backtest.date_range.start_date;
  const fullEnd = backtest.date_range.end_date;
  const fullYears = calculateHorizonYears(fullStart, fullEnd);

  const strategyRow: ComparisonTableRow = {
    key: "strategy",
    label: `${backtest.summary.strategy} (Combined Protection)`,
    period_label: `${fullStart} → ${fullEnd}`,
    horizon_years: fullYears,
    is_partial: false,
    final_value_usd: backtest.summary.final_value_usd,
    total_return_pct: backtest.summary.total_return_pct,
    cagr_pct: backtest.summary.cagr_pct,
    maximum_drawdown_pct: backtest.summary.maximum_drawdown_pct,
    annualized_volatility_pct: backtest.summary.annualized_volatility_pct,
    sharpe_rf0: backtest.summary.sharpe_rf0,
    switches: backtest.summary.switches,
    cash_days: backtest.summary.cash_days,
  };

  const solStart = resolveSolanaStartDate(backtest, solanaStartDateOverride);

  const benchmarkRows: ComparisonTableRow[] = backtest.benchmark_summaries.map((b) => {
    const isSolana = b.strategy.toLowerCase().includes("solana");
    const periodStart = isSolana ? solStart : fullStart;
    const years = calculateHorizonYears(periodStart, fullEnd);

    return {
      key: b.strategy,
      label: b.strategy,
      period_label: `${periodStart} → ${fullEnd}`,
      horizon_years: years,
      is_partial: isSolana,
      final_value_usd: b.final_value_usd,
      total_return_pct: b.total_return_pct,
      cagr_pct: b.cagr_pct,
      maximum_drawdown_pct: b.maximum_drawdown_pct,
      annualized_volatility_pct: b.annualized_volatility_pct,
      sharpe_rf0: b.sharpe_rf0,
      switches: b.switches,
      cash_days: b.cash_days,
    };
  });

  return [strategyRow, ...benchmarkRows];
}

/**
 * Extract dynamic metadata for the Benchmark Comparability Notice banner.
 */
export function getBenchmarkComparabilityNotice(
  backtest: Pick<
    ConstrainedBacktestResponse,
    "benchmark_summaries" | "date_range" | "benchmark_curves"
  >,
  solanaStartDateOverride?: string | null
): BenchmarkComparabilityNoticeInfo {
  const fullStart = backtest.date_range.start_date;
  const fullEnd = backtest.date_range.end_date;
  const solStart = resolveSolanaStartDate(backtest, solanaStartDateOverride);

  const solSummary = backtest.benchmark_summaries.find((b) =>
    b.strategy.toLowerCase().includes("solana")
  );

  return {
    strategyHorizonYears: calculateHorizonYears(fullStart, fullEnd),
    solanaHorizonYears: calculateHorizonYears(solStart, fullEnd),
    solanaStartDate: solStart,
    solanaCagrPct: solSummary?.cagr_pct ?? null,
    fullStartDate: fullStart,
    fullEndDate: fullEnd,
  };
}

