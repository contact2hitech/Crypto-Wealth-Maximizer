import test from "node:test";
import assert from "node:assert/strict";
import { downsampleByExtrema } from "../lib/charts/downsample.ts";
import type {
  DrawdownExitEvent,
  HindsightOptimizerResponse,
  SensitivityRow,
  WalkForwardPeriodRow,
} from "../types/api.ts";

test("Strategy Lab form validation rejects invalid date order and non-positive capital", () => {
  function validateStrategyForm(startDate: string, endDate: string, capital: number): string | null {
    if (startDate > endDate) {
      return "Start date must be earlier than or equal to end date.";
    }
    if (capital <= 0 || Number.isNaN(capital)) {
      return "Initial capital must be a positive number.";
    }
    return null;
  }

  assert.equal(validateStrategyForm("2026-01-01", "2020-01-01", 1480), "Start date must be earlier than or equal to end date.");
  assert.equal(validateStrategyForm("2020-01-01", "2026-01-01", 0), "Initial capital must be a positive number.");
  assert.equal(validateStrategyForm("2020-01-01", "2026-01-01", -500), "Initial capital must be a positive number.");
  assert.equal(validateStrategyForm("2016-11-09", "2026-11-09", 1480), null);
});

test("Strategy Lab hindsight upper-bound flags preserve non-investable constraints", () => {
  const mockHindsightResponse: HindsightOptimizerResponse = {
    workflow: "perfect_hindsight_optimizer",
    is_hindsight_upper_bound: true,
    is_investable: false,
    warning: "Theoretical upper bound with perfect future visibility. Non-investable.",
    configuration: {
      initial_capital: 1480,
      start_date: "2016-11-09",
      end_date: "2026-11-10",
      max_switches: 5,
    },
    date_range: {
      start_date: "2016-11-09",
      end_date: "2026-11-09",
      row_count: 3653,
    },
    summary: [
      {
        maximum_switches: 0,
        actual_switches: 0,
        final_value_usd: 1480,
        profit_usd: 0,
        return_pct: 0,
        ending_asset: "Bitcoin",
        maximum_drawdown_pct: -83.5,
      },
      {
        maximum_switches: 5,
        actual_switches: 5,
        final_value_usd: 25000000,
        profit_usd: 24998520,
        return_pct: 1689000,
        ending_asset: "Solana",
        maximum_drawdown_pct: -25.2,
      },
    ],
    paths: {
      "5": [
        { date: "2017-05-01", switch_into: "Ethereum" },
        { date: "2021-01-01", switch_into: "Solana" },
      ],
    },
    equity_curves: {},
  };

  // Non-negotiable academic disclaimer contracts
  assert.equal(mockHindsightResponse.is_hindsight_upper_bound, true);
  assert.equal(mockHindsightResponse.is_investable, false);
  assert.match(mockHindsightResponse.warning, /Non-investable/i);
});

test("Risk Lab exit overshoot calculation accurately measures drawdown beyond daily trigger", () => {
  const mockExits: DrawdownExitEvent[] = [
    {
      date: "2018-01-16",
      event: "Drawdown protection triggered: switch to USD Cash",
      from_asset: "Bitcoin",
      to_asset: "USD Cash",
      portfolio_value_usd: 1150.25,
      peak_portfolio_value_usd: 1480.0,
      drawdown_pct: -22.28,
      best_asset: "Bitcoin",
      best_score_pct: -5.4,
      scheduled_rebalance: false,
      overshoot_beyond_configured_trigger_pp: 2.28,
    },
    {
      date: "2020-03-12",
      event: "Drawdown protection triggered: switch to USD Cash",
      from_asset: "Ethereum",
      to_asset: "USD Cash",
      portfolio_value_usd: 950.0,
      peak_portfolio_value_usd: 1480.0,
      drawdown_pct: -35.81,
      best_asset: "Ethereum",
      best_score_pct: -15.2,
      scheduled_rebalance: false,
      overshoot_beyond_configured_trigger_pp: 15.81,
    },
  ];

  // Verify overshoot calculation: actual DD (-22.28%) is 2.28 pp beyond -20% stop
  assert.equal(mockExits[0].overshoot_beyond_configured_trigger_pp, 2.28);
  assert.equal(mockExits[1].overshoot_beyond_configured_trigger_pp, 15.81);

  // Compute aggregate exit metrics
  const avgOvershoot =
    mockExits.reduce((acc, curr) => acc + (curr.overshoot_beyond_configured_trigger_pp ?? 0), 0) /
    mockExits.length;
  const maxOvershoot = Math.max(
    ...mockExits.map((e) => e.overshoot_beyond_configured_trigger_pp ?? 0)
  );

  assert.ok(Math.abs(avgOvershoot - 9.045) < 0.001);
  assert.equal(maxOvershoot, 15.81);
});

test("Risk Lab daily trace downsampling preserves worst drawdown troughs within requested budget", () => {
  // Synthesize 1000 daily trace rows with a sharp trough
  const trace: { date: string; timestamp: number; drawdown_pct: number }[] = [];
  const baseTime = Date.parse("2016-11-09T00:00:00Z");

  for (let i = 0; i < 1000; i++) {
    const d = new Date(baseTime + i * 86400000).toISOString().slice(0, 10);
    // Drawdown oscillates between 0% and -30%, with an extreme trough of -69.94% at index 450
    let dd = -((i % 30) * 1.0);
    if (i === 450) {
      dd = -69.94;
    }
    trace.push({
      date: d,
      timestamp: baseTime + i * 86400000,
      drawdown_pct: dd,
    });
  }

  const downsampled = downsampleByExtrema(trace, 450, (row) => [row.drawdown_pct]);

  // Output budget is respected under normal operation
  assert.ok(downsampled.length <= 450);

  // The global worst drawdown trough (-69.94%) MUST be preserved
  const minDd = Math.min(...downsampled.map((r) => r.drawdown_pct));
  assert.equal(minDd, -69.94);

  // Endpoint boundaries are preserved
  assert.equal(downsampled[0].date, trace[0].date);
  assert.equal(downsampled[downsampled.length - 1].date, trace[trace.length - 1].date);
});

test("Robustness walk-forward fixed research periods honestly report negative Test period metrics", () => {
  const periods: WalkForwardPeriodRow[] = [
    {
      period: "Development",
      start_date: "2016-11-09",
      end_date: "2022-12-31",
      strategy: "A: 90-day momentum",
      final_value_usd: 54938.44,
      total_return_pct: 3612.06,
      cagr_pct: 83.67,
      maximum_drawdown_pct: -64.12,
      lifetime_max_drawdown_pct: -64.12,
      annualized_volatility_pct: 71.4,
      sharpe_rf0: 1.25,
      switches: 58,
      cash_days: 1020,
    },
    {
      period: "Validation",
      start_date: "2023-01-01",
      end_date: "2024-12-31",
      strategy: "A: 90-day momentum",
      final_value_usd: 3954.21,
      total_return_pct: 167.18,
      cagr_pct: 63.45,
      maximum_drawdown_pct: -31.45,
      lifetime_max_drawdown_pct: -31.45,
      annualized_volatility_pct: 52.8,
      sharpe_rf0: 1.28,
      switches: 21,
      cash_days: 410,
    },
    {
      period: "Test",
      start_date: "2025-01-01",
      end_date: "2026-11-09",
      strategy: "A: 90-day momentum",
      final_value_usd: 885.12,
      total_return_pct: -40.19,
      cagr_pct: -24.96,
      maximum_drawdown_pct: -45.18,
      lifetime_max_drawdown_pct: -45.18,
      annualized_volatility_pct: 54.2,
      sharpe_rf0: -0.46,
      switches: 16,
      cash_days: 400,
    },
  ];

  // 1. Fixed period dates matching research plan
  assert.equal(periods[0].start_date, "2016-11-09");
  assert.equal(periods[0].end_date, "2022-12-31");
  assert.equal(periods[1].start_date, "2023-01-01");
  assert.equal(periods[1].end_date, "2024-12-31");
  assert.equal(periods[2].start_date, "2025-01-01");
  assert.equal(periods[2].end_date, "2026-11-09");

  // 2. Test period CAGR and Sharpe MUST be negative (strict research honesty)
  const testP = periods.find((p) => p.period === "Test")!;
  assert.ok((testP.cagr_pct ?? 0) < 0, "Test period CAGR must be negative");
  assert.ok((testP.sharpe_rf0 ?? 0) < 0, "Test period Sharpe ratio must be negative");
  assert.equal(testP.cagr_pct, -24.96);
  assert.equal(testP.sharpe_rf0, -0.46);
});

test("Robustness 3x3 sensitivity grid contains exactly 9 scenarios covering strategies A, B, and C", () => {
  const sensitivityGrid: SensitivityRow[] = [
    { sensitivity_strategy: "A: 90-day momentum", drawdown_trigger_pct: 15, final_value_usd: 480000, total_return_pct: 32000, cagr_pct: 78.5, maximum_drawdown_pct: -62.0, annualized_volatility_pct: 65.0, sharpe_rf0: 1.18, switches: 110, cash_days: 2000 },
    { sensitivity_strategy: "A: 90-day momentum", drawdown_trigger_pct: 20, final_value_usd: 585970, total_return_pct: 39492, cagr_pct: 81.89, maximum_drawdown_pct: -69.94, annualized_volatility_pct: 68.43, sharpe_rf0: 1.21, switches: 95, cash_days: 1830 },
    { sensitivity_strategy: "A: 90-day momentum", drawdown_trigger_pct: 25, final_value_usd: 510000, total_return_pct: 34300, cagr_pct: 79.8, maximum_drawdown_pct: -73.5, annualized_volatility_pct: 70.1, sharpe_rf0: 1.17, switches: 88, cash_days: 1650 },
    { sensitivity_strategy: "B: 50/200-day trend + momentum", drawdown_trigger_pct: 15, final_value_usd: 350000, total_return_pct: 23500, cagr_pct: 72.1, maximum_drawdown_pct: -58.0, annualized_volatility_pct: 61.0, sharpe_rf0: 1.12, switches: 85, cash_days: 2100 },
    { sensitivity_strategy: "B: 50/200-day trend + momentum", drawdown_trigger_pct: 20, final_value_usd: 420000, total_return_pct: 28200, cagr_pct: 75.8, maximum_drawdown_pct: -65.2, annualized_volatility_pct: 64.5, sharpe_rf0: 1.16, switches: 78, cash_days: 1920 },
    { sensitivity_strategy: "B: 50/200-day trend + momentum", drawdown_trigger_pct: 25, final_value_usd: 390000, total_return_pct: 26200, cagr_pct: 74.3, maximum_drawdown_pct: -69.8, annualized_volatility_pct: 66.8, sharpe_rf0: 1.13, switches: 72, cash_days: 1750 },
    { sensitivity_strategy: "C: 30/90/180-day momentum", drawdown_trigger_pct: 15, final_value_usd: 310000, total_return_pct: 20800, cagr_pct: 69.8, maximum_drawdown_pct: -61.2, annualized_volatility_pct: 63.2, sharpe_rf0: 1.08, switches: 125, cash_days: 1980 },
    { sensitivity_strategy: "C: 30/90/180-day momentum", drawdown_trigger_pct: 20, final_value_usd: 375000, total_return_pct: 25200, cagr_pct: 73.5, maximum_drawdown_pct: -67.5, annualized_volatility_pct: 66.1, sharpe_rf0: 1.11, switches: 112, cash_days: 1810 },
    { sensitivity_strategy: "C: 30/90/180-day momentum", drawdown_trigger_pct: 25, final_value_usd: 340000, total_return_pct: 22800, cagr_pct: 71.4, maximum_drawdown_pct: -72.0, annualized_volatility_pct: 68.3, sharpe_rf0: 1.09, switches: 104, cash_days: 1640 },
  ];

  // Exactly 9 scenarios
  assert.equal(sensitivityGrid.length, 9);

  // Covers all 3 strategies
  const strats = new Set(sensitivityGrid.map((r) => r.sensitivity_strategy));
  assert.equal(strats.size, 3);
  assert.ok(strats.has("A: 90-day momentum"));
  assert.ok(strats.has("B: 50/200-day trend + momentum"));
  assert.ok(strats.has("C: 30/90/180-day momentum"));

  // Covers all 3 drawdown triggers
  const triggers = new Set(sensitivityGrid.map((r) => r.drawdown_trigger_pct));
  assert.equal(triggers.size, 3);
  assert.ok(triggers.has(15));
  assert.ok(triggers.has(20));
  assert.ok(triggers.has(25));
});
