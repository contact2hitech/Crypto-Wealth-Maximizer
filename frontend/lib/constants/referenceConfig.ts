import type { ConstrainedBacktestRequest } from "@/types/api";

/**
 * Canonical Crypto Wealth Maximizer v1.0 reference configuration
 * matching FINAL_RESEARCH_REPORT.md and POST /api/backtest/run defaults.
 */
export const REFERENCE_BACKTEST_CONFIG: ConstrainedBacktestRequest = {
  strategy: "A: 90-day momentum",
  initial_capital: 1480,
  start_date: "2016-11-09",
  end_date: "2026-11-10",
  rebalance_frequency: "Monthly",
  minimum_holding_days: 30,
  switching_threshold_pct: 10,
  fee_bps_per_switch: 10,
  allow_cash: true,
  enable_cash_filter: true,
  enable_drawdown_protection: true,
  drawdown_protection_pct: 20,
  cash_reentry_score_pct: 0,
  initialization_mode: "Invest immediately in Bitcoin",
  include_benchmarks: true,
  include_daily_trace: false,
};

export const MARKET_FULL_RANGE = {
  startDate: "2016-11-09",
  endDate: "2026-11-09",
  initialCapital: 1480,
} as const;

