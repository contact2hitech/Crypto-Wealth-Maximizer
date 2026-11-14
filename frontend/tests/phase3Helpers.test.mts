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
  assert.ok(sampled.length <= 150);
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

test("downsampleByExtrema preserves independent multi-series multi-scale extrema without occlusion", () => {
  // Test case with 3 widely differing value scales:
  // - Series A: Large numbers (50,000 - 120,000 USD)
  // - Series B: Small positive numbers (2 - 250 units)
  // - Series C: Negative percentages (-99.5% to +5.0%) with onset at index 350
  const rows = Array.from({ length: 1500 }, (_, i) => {
    let seriesA = 50000 + (i % 500);
    if (i === 210) seriesA = 25000; // Series A global min
    if (i === 890) seriesA = 120000; // Series A global max

    let seriesB = 50 + (i % 20);
    if (i === 430) seriesB = 2; // Series B global min
    if (i === 720) seriesB = 250; // Series B global max

    let seriesC: number | null = i < 350 ? null : -20 - (i % 30);
    if (i === 349) seriesC = null; // Series C onset null boundary
    if (i === 350) seriesC = -20; // Series C first valid observation
    if (i === 580) seriesC = -99.5; // Series C global min (trough)
    if (i === 1100) seriesC = 5.0; // Series C global max (peak)

    return { idx: i, seriesA, seriesB, seriesC };
  });

  const maxBudget = 150;
  const sampled = downsampleByExtrema(rows, maxBudget, (r) => [
    r.seriesA,
    r.seriesB,
    r.seriesC,
  ]);

  // 1. Point limit strictly enforced
  assert.ok(
    sampled.length <= maxBudget,
    `Sampled points (${sampled.length}) must not exceed limit (${maxBudget})`
  );

  // 2. First and last observations strictly preserved
  assert.equal(sampled[0].idx, 0, "First observation must be preserved");
  assert.equal(
    sampled[sampled.length - 1].idx,
    1499,
    "Last observation must be preserved"
  );

  // 3. Series onset boundaries strictly preserved
  assert.ok(
    sampled.some((r) => r.idx === 349 && r.seriesC === null),
    "Preceding null at series onset must be preserved"
  );
  assert.ok(
    sampled.some((r) => r.idx === 350 && r.seriesC === -20),
    "First valid observation at series onset must be preserved"
  );

  // 4. Series A extrema preserved despite lower-scale series existing
  assert.ok(
    sampled.some((r) => r.idx === 210 && r.seriesA === 25000),
    "Series A minimum (25,000) must be preserved despite Series B/C having smaller numbers"
  );
  assert.ok(
    sampled.some((r) => r.idx === 890 && r.seriesA === 120000),
    "Series A maximum (120,000) must be preserved"
  );

  // 5. Series B extrema preserved despite Series A having higher scale
  assert.ok(
    sampled.some((r) => r.idx === 430 && r.seriesB === 2),
    "Series B minimum (2) must be preserved"
  );
  assert.ok(
    sampled.some((r) => r.idx === 720 && r.seriesB === 250),
    "Series B maximum (250) must be preserved despite Series A having 100x larger values"
  );

  // 6. Series C extrema preserved
  assert.ok(
    sampled.some((r) => r.idx === 580 && r.seriesC === -99.5),
    "Series C minimum (-99.5) must be preserved"
  );
  assert.ok(
    sampled.some((r) => r.idx === 1100 && r.seriesC === 5.0),
    "Series C maximum (+5.0) must be preserved"
  );

  // 7. Strictly monotonic ordering
  for (let i = 1; i < sampled.length; i += 1) {
    assert.ok(
      sampled[i].idx > sampled[i - 1].idx,
      "Sampled indices must be strictly monotonic"
    );
  }
});

test("downsampleByExtrema handles mandatory points exceeding requested maxPoints gracefully", () => {
  const rows = Array.from({ length: 50 }, (_, i) => ({
    idx: i,
    s1: i,
    s2: i < 20 ? null : i,
  }));
  // Mandatory: idx 0, 49, 20 (first s2), 19 (preceding null). Total 4 mandatory points.
  // Request maxPoints = 2 (smaller than mandatory points)
  const sampled = downsampleByExtrema(rows, 2, (r) => [r.s1, r.s2]);
  assert.equal(sampled.length, 4);
  assert.equal(sampled[0].idx, 0);
  assert.equal(sampled[1].idx, 19);
  assert.equal(sampled[2].idx, 20);
  assert.equal(sampled[3].idx, 49);
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

