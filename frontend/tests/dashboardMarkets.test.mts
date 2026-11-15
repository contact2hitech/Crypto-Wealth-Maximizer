import test from "node:test";
import assert from "node:assert/strict";
import {
  dateToUtcTimestamp,
  formatAxisTimestamp,
  formatTooltipTimestamp,
} from "../components/charts/chartFormatters.ts";
import { REFERENCE_BACKTEST_CONFIG } from "../lib/constants/referenceConfig.ts";
import type {
  BenchmarkSummaryRow,
  ConstrainedBacktestRequest,
  ConstrainedSummaryRow,
  DateRangeInfo,
} from "../types/api.ts";

test("chartFormatters convert dates to UTC epoch timestamps and format accurately", () => {
  const ts = dateToUtcTimestamp("2016-11-09");
  assert.equal(ts, Date.parse("2016-11-09T00:00:00Z"));
  assert.equal(formatAxisTimestamp(ts), "2016-11");
  assert.equal(formatTooltipTimestamp(ts), "2016-11-09");

  // Leap year and year boundaries
  const leapTs = dateToUtcTimestamp("2024-02-29");
  assert.equal(formatAxisTimestamp(leapTs), "2024-02");
  assert.equal(formatTooltipTimestamp(leapTs), "2024-02-29");

  // String fallback or non-finite handling
  assert.equal(formatAxisTimestamp(NaN), "");
  assert.equal(formatTooltipTimestamp(NaN), "");
  assert.equal(formatAxisTimestamp("2020-04-10"), "2020-04");
  assert.equal(formatTooltipTimestamp("2020-04-10"), "2020-04-10");
  assert.equal(formatTooltipTimestamp(null), "");
  assert.equal(formatTooltipTimestamp(undefined), "");
});

test("timestamp sequence is strictly monotonic and proportional to calendar elapsed days", () => {
  const dates = ["2016-11-09", "2016-11-10", "2017-01-01", "2020-04-10", "2026-11-09"];
  const timestamps = dates.map(dateToUtcTimestamp);

  for (let i = 1; i < timestamps.length; i += 1) {
    assert.ok(timestamps[i] > timestamps[i - 1], `Timestamp ${timestamps[i]} must be > ${timestamps[i - 1]}`);
  }

  // 1 calendar day is exactly 86,400,000 ms
  const oneDayMs = 86_400_000;
  assert.equal(timestamps[1] - timestamps[0], oneDayMs);
});

test("benchmark table rows correctly tag Solana partial window and compute evaluation horizons", () => {
  const mockDateRange: DateRangeInfo = {
    start_date: "2016-11-09",
    end_date: "2026-11-09",
    row_count: 3653,
  };

  const mockSummary: ConstrainedSummaryRow = {
    strategy: "A: 90-day momentum",
    rebalance: "Monthly",
    minimum_hold_days: 30,
    switch_threshold_pct: 10,
    fee_per_switch_bps: 10,
    cash_enabled: true,
    cash_filter: true,
    drawdown_protection_pct: 20,
    initialization_mode: "Invest immediately in Bitcoin",
    lifetime_max_drawdown_pct: -69.94,
    final_value_usd: 585970.46,
    total_return_pct: 39492.6,
    cagr_pct: 81.89,
    maximum_drawdown_pct: -69.94,
    annualized_volatility_pct: 68.43,
    sharpe_rf0: 1.21,
    switches: 95,
    cash_days: 1830,
  };

  const mockBenchmarkSummaries: BenchmarkSummaryRow[] = [
    {
      strategy: "Buy & hold: Bitcoin",
      final_value_usd: 152438.67,
      total_return_pct: 10199.91,
      cagr_pct: 58.74,
      maximum_drawdown_pct: -83.56,
      annualized_volatility_pct: 64.95,
      sharpe_rf0: 0.9,
      switches: 0,
      cash_days: 0,
    },
    {
      strategy: "Buy & hold: Ethereum",
      final_value_usd: 301426.31,
      total_return_pct: 20266.64,
      cagr_pct: 70.36,
      maximum_drawdown_pct: -94.01,
      annualized_volatility_pct: 84.14,
      sharpe_rf0: 0.84,
      switches: 0,
      cash_days: 0,
    },
    {
      strategy: "Buy & hold: Solana",
      final_value_usd: 94747.88,
      total_return_pct: 6301.88,
      cagr_pct: 98.56,
      maximum_drawdown_pct: -96.34,
      annualized_volatility_pct: 108.62,
      sharpe_rf0: 0.91,
      switches: 0,
      cash_days: 0,
    },
  ];

  // Apply the Dashboard benchmark transformation logic
  const fullStart = mockDateRange.start_date;
  const fullEnd = mockDateRange.end_date;
  const fullDays = mockDateRange.row_count;
  const fullYears = (fullDays / 365.25).toFixed(1);

  const strategyRow = {
    key: "strategy",
    label: `${mockSummary.strategy} (Combined Protection)`,
    period_label: `${fullStart} → ${fullEnd}`,
    horizon_years: `${fullYears} yrs`,
    is_partial: false,
    cagr_pct: mockSummary.cagr_pct,
  };

  const benchmarkRows = mockBenchmarkSummaries.map((b) => {
    const isSolana = b.strategy.toLowerCase().includes("solana");
    const solStart = "2020-04-10";
    const periodStart = isSolana ? solStart : fullStart;
    const startMs = Date.parse(`${periodStart}T00:00:00Z`);
    const endMs = Date.parse(`${fullEnd}T00:00:00Z`);
    const years = ((endMs - startMs) / (86400000 * 365.25)).toFixed(1);

    return {
      key: b.strategy,
      label: b.strategy,
      period_label: `${periodStart} → ${fullEnd}`,
      horizon_years: `${years} yrs`,
      is_partial: isSolana,
      cagr_pct: b.cagr_pct,
    };
  });

  const allRows = [strategyRow, ...benchmarkRows];

  // 1. Verify 4 rows
  assert.equal(allRows.length, 4);

  // 2. Strategy row is 10.0 yrs full history
  assert.equal(strategyRow.period_label, "2016-11-09 → 2026-11-09");
  assert.equal(strategyRow.horizon_years, "10.0 yrs");
  assert.equal(strategyRow.is_partial, false);

  // 3. Bitcoin row is 10.0 yrs full history
  const btcRow = allRows.find((r) => r.key === "Buy & hold: Bitcoin")!;
  assert.equal(btcRow.period_label, "2016-11-09 → 2026-11-09");
  assert.equal(btcRow.horizon_years, "10.0 yrs");
  assert.equal(btcRow.is_partial, false);

  // 4. Ethereum row is 10.0 yrs full history
  const ethRow = allRows.find((r) => r.key === "Buy & hold: Ethereum")!;
  assert.equal(ethRow.period_label, "2016-11-09 → 2026-11-09");
  assert.equal(ethRow.horizon_years, "10.0 yrs");
  assert.equal(ethRow.is_partial, false);

  // 5. Solana row MUST be tagged as is_partial = true with 6.6 yrs window
  const solRow = allRows.find((r) => r.key === "Buy & hold: Solana")!;
  assert.equal(solRow.period_label, "2020-04-10 → 2026-11-09");
  assert.equal(solRow.horizon_years, "6.6 yrs");
  assert.equal(solRow.is_partial, true);
  assert.equal(solRow.cagr_pct, 98.56);
});

test("dynamic configuration fallback resolves to REFERENCE_BACKTEST_CONFIG when response is null", () => {
  const nullBacktestConfig: ConstrainedBacktestRequest | null = null;
  const config = nullBacktestConfig ?? REFERENCE_BACKTEST_CONFIG;

  assert.equal(config.strategy, "A: 90-day momentum");
  assert.equal(config.rebalance_frequency, "Monthly");
  assert.equal(config.minimum_holding_days, 30);
  assert.equal(config.switching_threshold_pct, 10);
  assert.equal(config.fee_bps_per_switch, 10);
  assert.equal(config.enable_cash_filter, true);
  assert.equal(config.drawdown_protection_pct, 20);
  assert.equal(config.cash_reentry_score_pct, 0);
  assert.equal(config.initialization_mode, "Invest immediately in Bitcoin");
});

test("Markets common-start range filters out observations before common_start_date", () => {
  const commonStartDate = "2020-04-10";
  const rawPoints = [
    { date: "2016-11-09", Bitcoin: 100, Ethereum: 100, Solana: null },
    { date: "2018-05-01", Bitcoin: 150, Ethereum: 120, Solana: null },
    { date: "2020-04-09", Bitcoin: 200, Ethereum: 180, Solana: null },
    { date: "2020-04-10", Bitcoin: 100, Ethereum: 100, Solana: 100 },
    { date: "2022-01-01", Bitcoin: 300, Ethereum: 250, Solana: 400 },
    { date: "2026-11-09", Bitcoin: 500, Ethereum: 400, Solana: 600 },
  ];

  const overlapOnly = rawPoints.filter((pt) => pt.date >= commonStartDate);
  assert.equal(overlapOnly.length, 3);
  assert.equal(overlapOnly[0].date, "2020-04-10");
  assert.equal(overlapOnly[0].Solana, 100);
  assert.equal(overlapOnly[overlapOnly.length - 1].date, "2026-11-09");
});
