import test from "node:test";
import assert from "node:assert/strict";
import { downsampleByExtrema } from "../lib/charts/downsample.ts";
import { REFERENCE_BACKTEST_CONFIG } from "../lib/constants/referenceConfig.ts";
import {
  formatInteger,
  formatPercent,
  formatRatio,
  formatUsd,
} from "../lib/formatters/financial.ts";

test("REFERENCE_BACKTEST_CONFIG matches v1.0 FINAL_RESEARCH_REPORT reference settings", () => {
  assert.equal(REFERENCE_BACKTEST_CONFIG.strategy, "A: 90-day momentum");
  assert.equal(REFERENCE_BACKTEST_CONFIG.initial_capital, 1480);
  assert.equal(REFERENCE_BACKTEST_CONFIG.start_date, "2016-11-09");
  assert.equal(REFERENCE_BACKTEST_CONFIG.end_date, "2026-11-10");
  assert.equal(REFERENCE_BACKTEST_CONFIG.rebalance_frequency, "Monthly");
  assert.equal(REFERENCE_BACKTEST_CONFIG.minimum_holding_days, 30);
  assert.equal(REFERENCE_BACKTEST_CONFIG.switching_threshold_pct, 10);
  assert.equal(REFERENCE_BACKTEST_CONFIG.fee_bps_per_switch, 10);
  assert.equal(REFERENCE_BACKTEST_CONFIG.drawdown_protection_pct, 20);
  assert.equal(REFERENCE_BACKTEST_CONFIG.cash_reentry_score_pct, 0);
  assert.equal(
    REFERENCE_BACKTEST_CONFIG.initialization_mode,
    "Invest immediately in Bitcoin"
  );
  assert.equal(REFERENCE_BACKTEST_CONFIG.include_benchmarks, true);
  assert.equal(REFERENCE_BACKTEST_CONFIG.include_daily_trace, false);
});

test("downsampleByExtrema preserves endpoints, series onset, and peak/trough extrema", () => {
  const rows = Array.from({ length: 1200 }, (_, i) => ({
    idx: i,
    btc: 100 + i,
    sol: i < 400 ? null : 10 + (i - 400),
    dd: i === 555 ? -69.94 : -10,
  }));

  const sampled = downsampleByExtrema(rows, 150, (r) => [r.btc, r.sol, r.dd]);
  assert.ok(sampled.length <= 155);
  assert.equal(sampled[0].idx, 0);
  assert.equal(sampled[sampled.length - 1].idx, 1199);

  // Exact Solana onset boundary (399 null, 400 first valid) and exact -69.94 trough must be preserved.
  assert.ok(sampled.some((r) => r.idx === 399 && r.sol === null));
  assert.ok(sampled.some((r) => r.idx === 400 && r.sol === 10));
  assert.ok(sampled.some((r) => r.idx === 555 && r.dd === -69.94));

  // Strictly monotonic indices
  for (let i = 1; i < sampled.length; i += 1) {
    assert.ok(sampled[i].idx > sampled[i - 1].idx);
  }
});

test("financial formatters return em-dash for null/non-finite values and format numbers cleanly", () => {
  assert.equal(formatUsd(null), "—");
  assert.equal(formatUsd(Number.NaN), "—");
  assert.equal(formatUsd(585970.46), "$585,970.46");
  assert.equal(formatPercent(39492.5988), "39,492.60%");
  assert.equal(formatPercent(-69.9385), "-69.94%");
  assert.equal(formatRatio(1.2115), "1.21");
  assert.equal(formatInteger(3653), "3,653");
});

