import test from "node:test";
import assert from "node:assert/strict";
import { downsampleByExtrema } from "../lib/charts/downsample.ts";
import { calculateHorizonYears } from "../lib/formatters/benchmarkComparisons.ts";
import {
  calculateExitOvershoot,
  isHindsightNonInvestable,
  validateRiskFormInput,
  validateStrategyFormInput,
} from "../lib/validation/strategyForm.ts";

test("validateStrategyFormInput enforces date ordering, positive capital, and valid formats", () => {
  // Valid inputs
  assert.equal(
    validateStrategyFormInput({ startDate: "2016-11-09", endDate: "2026-11-09", initialCapital: 1480 }),
    null
  );
  assert.equal(
    validateStrategyFormInput({ startDate: "2020-01-01", endDate: "2020-01-01", initialCapital: 100 }),
    null
  );

  // Inverted date range
  assert.equal(
    validateStrategyFormInput({ startDate: "2026-11-09", endDate: "2016-11-09", initialCapital: 1480 }),
    "Start date must be earlier than or equal to end date."
  );

  // Non-positive capital boundaries
  assert.equal(
    validateStrategyFormInput({ startDate: "2016-11-09", endDate: "2026-11-09", initialCapital: 0 }),
    "Initial capital must be a positive number."
  );
  assert.equal(
    validateStrategyFormInput({ startDate: "2016-11-09", endDate: "2026-11-09", initialCapital: -500 }),
    "Initial capital must be a positive number."
  );
  assert.equal(
    validateStrategyFormInput({ startDate: "2016-11-09", endDate: "2026-11-09", initialCapital: Number.NaN }),
    "Initial capital must be a positive number."
  );

  // Malformed date formats
  assert.equal(
    validateStrategyFormInput({ startDate: "not-a-date", endDate: "2026-11-09", initialCapital: 1480 }),
    "Invalid date format. Expected YYYY-MM-DD."
  );
  assert.equal(
    validateStrategyFormInput({ startDate: "", endDate: "2026-11-09", initialCapital: 1480 }),
    "Start date and end date are required."
  );
});

test("validateRiskFormInput enforces drawdown protection percentage bounds and date range", () => {
  // Valid inputs
  assert.equal(
    validateRiskFormInput({ startDate: "2016-11-09", endDate: "2026-11-09", drawdownProtectionPct: 20 }),
    null
  );

  // Inverted dates
  assert.equal(
    validateRiskFormInput({ startDate: "2025-01-01", endDate: "2020-01-01", drawdownProtectionPct: 20 }),
    "Start date must be earlier than or equal to end date."
  );

  // Stop trigger boundary conditions (must be 1% to 100%)
  assert.equal(
    validateRiskFormInput({ startDate: "2016-11-09", endDate: "2026-11-09", drawdownProtectionPct: 0 }),
    "Drawdown protection threshold must be between 1% and 100%."
  );
  assert.equal(
    validateRiskFormInput({ startDate: "2016-11-09", endDate: "2026-11-09", drawdownProtectionPct: -15 }),
    "Drawdown protection threshold must be between 1% and 100%."
  );
  assert.equal(
    validateRiskFormInput({ startDate: "2016-11-09", endDate: "2026-11-09", drawdownProtectionPct: 150 }),
    "Drawdown protection threshold must be between 1% and 100%."
  );
  assert.equal(
    validateRiskFormInput({ startDate: "2016-11-09", endDate: "2026-11-09", drawdownProtectionPct: Number.NaN }),
    "Drawdown protection threshold must be between 1% and 100%."
  );
});

test("calculateExitOvershoot accurately measures gap overshoot beyond stop trigger", () => {
  // Within trigger: no overshoot
  assert.equal(calculateExitOvershoot(-15.0, 20.0), 0);
  assert.equal(calculateExitOvershoot(-20.0, 20.0), 0);

  // Breach: exact difference in percentage points
  assert.equal(calculateExitOvershoot(-24.0154, 20.0), 4.0154);
  assert.equal(calculateExitOvershoot(-40.2622, 20.0), 20.2622);

  // Positive trigger input normalization
  assert.equal(calculateExitOvershoot(-25.5, -20.0), 5.5);
  assert.equal(calculateExitOvershoot(30.0, 25.0), 5.0);
});

test("isHindsightNonInvestable strictly enforces non-investable upper bound contracts", () => {
  // Valid non-investable hindsight response
  assert.equal(
    isHindsightNonInvestable(
      true,
      false,
      "Perfect-hindsight dynamic programming uses full knowledge of future prices. It is a non-investable theoretical upper-bound experiment, not a usable trading strategy."
    ),
    true
  );

  // Rejects investable flag
  assert.equal(
    isHindsightNonInvestable(true, true, "Theoretical non-investable upper bound"),
    false
  );

  // Rejects missing upper bound flag
  assert.equal(
    isHindsightNonInvestable(false, false, "Theoretical non-investable upper bound"),
    false
  );

  // Rejects missing or non-disclosing warning string
  assert.equal(isHindsightNonInvestable(true, false, "Profitable strategy"), false);
  assert.equal(isHindsightNonInvestable(true, false, undefined), false);
});

test("calculateHorizonYears computes true calendar horizons from ISO dates", () => {
  // Full 10-year reference window (3653 days / 365.25 = 10.0)
  assert.equal(calculateHorizonYears("2016-11-09", "2026-11-09"), "10.0 yrs");

  // Solana 6.6-year post-launch window (2020-04-10 to 2026-11-09 = 2405 days / 365.25 = 6.6)
  assert.equal(calculateHorizonYears("2020-04-10", "2026-11-09"), "6.6 yrs");

  // Invalid or inverted dates return fallback dash
  assert.equal(calculateHorizonYears("2026-11-09", "2016-11-09"), "—");
  assert.equal(calculateHorizonYears("invalid", "2026-11-09"), "—");
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
