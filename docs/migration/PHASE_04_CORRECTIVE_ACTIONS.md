# Phase 4 Corrective Actions Report — Crypto Wealth Maximizer v2.0

- **Working Branch**: `v2.0-nextjs-migration`
- **Date**: `2026-11-17`
- **Reviewed Implementation Commit**: `cc002e61be95a54415239bfad789a007e96d3b17` (`cc002e6`)
- **Review Report Commit**: `6f18264` (`docs/migration/PHASE_04_EXTERNAL_TECHNICAL_REVIEW.md`)
- **Initial External Review Verdict**: `REJECTED — corrections required before Phase 4 closure`
- **Status Following Corrective Action**: **CORRECTIONS IMPLEMENTED — AWAITING EXTERNAL RE-REVIEW**
- **Phase 5 Status**: **LOCKED — EXTERNAL SIGN-OFF AND PROJECT-OWNER AUTHORIZATION REQUIRED**

---

## 1. Executive Summary & Corrective Commits

Following independent external technical review by Claude (`6f18264`), all seven review findings (D1 through D7) have been thoroughly investigated, resolved, and verified across four atomic commits on `v2.0-nextjs-migration`:

| Commit | Hash | Description | Findings Addressed |
|---|---|---|---|
| 1 | `802a92d` | `fix(robustness,strategy-lab): derive honesty banner dynamically and add hindsight fee disclosures` | D1, D5, D6 |
| 2 | `54f2dbe` | `test(phase4): improve unit test isolation and e2e live data verification` | D3, D4 |
| 3 | *(Current)* | `docs(migration): reconcile reporting figures and document corrective actions` | D2, D7, and Migration Docs |
| 4 | *(Pending)* | `test(regression): full multi-suite verification and review handover` | Full Regression Handover |

All tests pass cleanly:
- Frontend Unit Tests: `22 / 22` passed (`862ms`).
- TypeScript (`npx tsc --noEmit`): `0` errors.
- ESLint (`npm run lint`): `0` errors, `0` warnings.
- Production Build (`npm run build`): `10 / 10` static pages generated.
- Playwright E2E (`node frontend/e2e/verify_phase4.mjs`): `0` console errors, `0` page errors, live API data verified across all tabs and viewports.
- Backend Parity (`backend/tests`): `21 / 21` passed.
- Legacy v1.0 Tests (`tests`): `26 / 26` passed.
- Immutability: Zero modifications to Python engines, canonical CSV dataset, root `tests/`, `app.py`, or FastAPI backend.

---

## 2. Corrective Actions Detail (D1 – D7)

### D1: Hardcoded Statistic and Fallbacks in Robustness Honesty Banner (High)

#### Review Finding
The honesty banner on `/robustness` contained:
- A hardcoded, inaccurate in-sample development statistic (`+83.67% CAGR`), which disagreed with the live backend (`134.71%`).
- Hardcoded fallback figures (`"-24.96%"`, `"-0.46"`).
- An unsupported causal narrative ("range-bound chop, false breakouts, and lack of sustained asset trends").
- An unconditional display that did not reflect user configuration changes.

#### Corrective Implementation
- File: `frontend/components/robustness/RobustnessClient.tsx`
- Removed all hardcoded statistics (`+83.67%`, `-24.96%`, `-0.46`) and unsupported causal prose.
- Dynamically derives Development, Validation, and Test period statistics directly from `robustnessData.walk_forward.periods` via `useMemo` with safe optional chaining.
- Implemented a neutral loading skeleton during initial load or while re-fetching:
  ```tsx
  {loading && !robustnessData && (
    <div className="rounded-lg border border-border bg-card/60 p-4 text-xs text-muted-foreground animate-pulse">
      <div className="flex items-center gap-3">
        <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
        <span>Loading walk-forward out-of-sample research metrics for {strategy}...</span>
      </div>
    </div>
  )}
  ```
- Renders the honesty banner only when live `robustnessData` and `testPeriod` are available.
- Added active configuration badge identifying the evaluated strategy and stop trigger:
  ```tsx
  <Badge variant="outline" className="border-rose-400/30 text-rose-300 font-mono text-[10px]">
    Configuration: {robustnessData.configuration.strategy} ({robustnessData.configuration.drawdown_protection_pct}% Stop)
  </Badge>
  ```
- Added initial mount debouncing (`setTimeout(..., 50)`) to eliminate redundant request cancellation and duplicate thread contention under React 18 Strict Mode.

---

### D2: Incorrect Reporting Figures in Review Package (High)

#### Review Finding
Figures reported for five endpoints in `PHASE_04_EXTERNAL_REVIEW.md` and `PHASE_04_REPORT.md` could not be reproduced from the live FastAPI backend or Python engines.

#### Root-Cause Analysis
Previous draft reports prematurely logged provisional mock values and copy-paste values from earlier exploratory scripts without running a direct programmatic execution pass against the reference configuration.

#### Corrective Action & Live Ground-Truth Figures
Executed all endpoints directly against the live FastAPI backend (`reproduce_all.py`) and verified against `optimization_engine.py` and `robustness_engine.py` with reference configuration:
- Reference Settings: Strategy A (90-day momentum), Initial Capital $1,480, Monthly rebalance, 30d min hold, 10% switching threshold, 10 bps fee per switch, 20% drawdown protection, 0% cash recovery score, Invest immediately in Bitcoin, 2016-11-09 → 2026-11-10.

| Endpoint & Metric | Previous Claimed Figure | Reproduced Live Backend & Engine Figure | Status |
|---|---|---|---|
| **`POST /api/backtest/run`** | | | |
| Final Portfolio Value | $585,970.46 | **$585,970.46** | Matches |
| CAGR | 81.89% | **81.89%** | Matches |
| Maximum Drawdown | -69.94% | **-69.94%** | Matches |
| Annualized Volatility | 68.43% | **68.43%** | Matches |
| Sharpe Ratio (rf=0) | 1.21 | **1.21** | Matches |
| Switches | 95 | **95** | Matches |
| Cash Days | 1,830 | **1,830** | Matches |
| **`POST /api/backtest/compare`** | | | |
| Mode A – Cash filter only | $585,970.46 | **$2,668,905.12** (CAGR 111.67%, MaxDD -85.63%, Sharpe 1.29) | Reconciled |
| Mode B – Drawdown protection only | $152,438.67 | **$661,870.95** (CAGR 84.11%, MaxDD -78.43%, Sharpe 1.22) | Reconciled |
| Mode C – Combined protection | $585,970.46 | **$585,970.46** (CAGR 81.89%, MaxDD -69.94%, Sharpe 1.21) | Matches |
| Mode D – No cash protection | $152,438.67 | **$5,100,729.25** (CAGR 125.83%, MaxDD -91.61%, Sharpe 1.33) | Reconciled |
| Benchmark – Bitcoin | $152,438.67 | **$152,438.67** (CAGR 58.97%, MaxDD -83.40%, Sharpe 1.03) | Matches |
| Benchmark – Ethereum | $295,317.15 | **$295,317.15** (CAGR 69.84%, MaxDD -93.96%, Sharpe 1.04) | Matches |
| Benchmark – Solana | $135,199.89 | **$135,199.89** (CAGR 98.56%, MaxDD -96.27%, Sharpe 1.16) | Matches |
| **`POST /api/backtest/practical`** | | | |
| Benchmark: Buy & Hold BTC | $152,438.67 | **$152,438.67** (CAGR 58.97%, MaxDD -83.40%) | Matches |
| Strategy A: 90-day momentum | $585,970.46 | **$4,357,408.61** (CAGR 122.30%, MaxDD -91.18%) | Reconciled |
| Strategy B: 50/200-day trend + mom | $53,889.39 | **$2,724,582.89** (CAGR 112.10%, MaxDD -93.14%) | Reconciled |
| Strategy C: 30/90/180-day momentum | $70,302.73 | **$660,608.36** (CAGR 84.08%, MaxDD -88.86%) | Reconciled |
| **`POST /api/backtest/hindsight`** | | | |
| Switch Budget K = 5 | $113,383,230.13 | **$552,814,299.71** (Return +37,352,217.55%, Ending: SOL) | Reconciled |
| Hindsight Contract Flags | non-investable | `is_hindsight_upper_bound: true`, `is_investable: false` | Matches |
| Hindsight Fee Policy | 10 bps fee claimed | Strictly 0 bps fee-free (schema has no fee field) | Reconciled |
| **`POST /api/risk/protection`** | | | |
| Total Drawdown Exits | 14 | **40** | Reconciled |
| Average Exit Drawdown | -22.84% | **-24.02%** | Reconciled |
| Median Exit Drawdown | — | **-22.66%** | Reconciled |
| Worst Exit Drawdown | -35.81% | **-40.26%** (Date: 2020-09-05) | Reconciled |
| Average Trigger Overshoot | — | **4.02 pp** | Reconciled |
| Maximum Trigger Overshoot | 15.81 pp | **20.26 pp** | Reconciled |
| Daily Execution Trace Rows | 3,653 | **3,653** | Matches |
| **`POST /api/robustness/analyze`** | | | |
| Development (2016-11-09 → 2022-12-31) | CAGR 144.15% | Final **$279,026.03**, CAGR **134.71%**, Sharpe **1.49**, MaxDD **-69.94%** | Reconciled |
| Validation (2023-01-01 → 2024-12-31) | CAGR 111.45% | Final **$4,896.00**, CAGR **82.05%**, Sharpe **1.27**, MaxDD **-41.31%** | Reconciled |
| Test (2025-01-01 → 2026-11-09) | CAGR -24.96% | Final **$939.53**, CAGR **-21.74%**, Sharpe **-0.46**, MaxDD **-52.02%** | Reconciled |

All affected migration documents (`PHASE_04_REPORT.md`, `PHASE_04_EXTERNAL_REVIEW.md`, `TEST_RESULTS.md`, `PROJECT_STATUS.md`) have been updated with these verified ground-truth numbers.

---

### D3: False-Pass E2E Test on Hardcoded Fallback Text (Medium)

#### Review Finding
`frontend/e2e/verify_phase4.mjs` waited for `-24.96%`, which was merely the hardcoded fallback text in D1 rather than live backend data. It also omitted assertions for Compare, Practical, Hindsight, and Risk metrics.

#### Corrective Implementation
- File: `frontend/e2e/verify_phase4.mjs`
- Replaced assertion on hardcoded `-24.96%` fallback with assertions on live API data:
  - Walk-forward table live metrics: Development CAGR `134.71%`, Validation CAGR `82.05%`, Test CAGR `-21.74%`, Test Final Value `$939.53`.
  - Dynamic honesty banner live metrics: `-21.74%` and `-0.46`.
- Added live assertions across all Strategy Lab tabs:
  - 4 Protection Modes: `A – Cash filter only` (`$2,668,905.12`), `D – No cash protection` (`$5,100,729.25`), `C – Combined protection` (`$585,970.46`).
  - Practical Strategies: `A: 90-day momentum` (`$4,357,408.61`), `B: 50/200-day trend + momentum` (`$2,724,582.89`), `C: 30/90/180-day momentum` (`$660,608.36`).
  - Perfect Hindsight: Final value `$552,814,299.71` and fee-free disclaimer.
- Added live assertions for Risk Lab: worst exit (`-40.26%`), max overshoot (`20.26 pp`), cash days (`1,830`), worst exit date (`2020-09-05`).
- Captures full-page screenshots strictly after live data has rendered, eliminating loading-skeleton screenshot captures.
- **Verification**: Ran `node frontend/e2e/verify_phase4.mjs` with 0 console errors, 0 page errors, and 100% live data verified.

---

### D4: Circular Unit Tests in Phase 4 Test Suite (Medium)

#### Review Finding
`frontend/tests/phase4Labs.test.mts` re-implemented validation logic inline within test bodies and asserted against invented mock data, meaning the tests would pass even if production code was broken.

#### Corrective Implementation
1. **Created Shared Production Validation Module**:
   - File: `frontend/lib/validation/strategyForm.ts`
   - Exports real production validation and business logic:
     - `validateStrategyFormInput`: Enforces date ordering, positive capital, and ISO formats.
     - `validateRiskFormInput`: Enforces drawdown protection bounds (1–99%), recovery score bounds, and date order.
     - `calculateExitOvershoot`: Real gap overshoot calculation (`Math.max(0, actualExitDrawdownPct - stopTriggerPct)`).
     - `isHindsightNonInvestable`: Strict schema enforcement for `is_hindsight_upper_bound` and `is_investable`.
2. **Refactored Client Components**:
   - `frontend/components/strategy-lab/StrategyLabClient.tsx`: Imports and uses `validateStrategyFormInput`.
   - `frontend/components/risk-lab/RiskLabClient.tsx`: Imports and uses `validateRiskFormInput`.
3. **Rewrote Unit Test Suite**:
   - File: `frontend/tests/phase4Labs.test.mts`
   - Completely deleted all inline re-implementations and invented mock rows.
   - Directly imports and tests:
     - Production validation functions from `frontend/lib/validation/strategyForm.ts`.
     - Production horizon calculations from `frontend/lib/formatters/benchmarkComparisons.ts`.
     - Production downsampling trough preservation on real-world trace data from `frontend/lib/charts/downsample.ts`.
- **Verification**: `npm test --prefix frontend` passes all 22/22 unit tests cleanly in 862 ms.

---

### D5: Deferred Phase 3 Fallbacks and Literals (Low)

#### Review Finding
`DashboardClient.tsx` and `benchmarkComparisons.ts` still retained literal fallback strings (`"2020-04-10"`, `"10.0 yrs"`, `"6.6 yrs"`, `"98.56%"`).

#### Corrective Implementation
- File: `frontend/lib/formatters/benchmarkComparisons.ts`
  - Updated `resolveSolanaStartDate`: Returns `string | null` instead of falling back to literal `"2020-04-10"`.
  - Updated `buildComparisonRows`: Dynamically marks Solana row as partial only when an actual start date exists.
  - Updated `getBenchmarkComparabilityNotice`: Emits dynamic notice only when Solana metadata is present.
- File: `frontend/components/dashboard/DashboardClient.tsx`
  - Replaced literal `"2020-04-10"` fallback with `null`.
  - Dynamically calculates evaluation horizon in the retrospective baseline banner:
    ```tsx
    {backtest
      ? `Evaluation: ${backtest.date_range.start_date} → ${backtest.date_range.end_date} (${calculateHorizonYears(backtest.date_range.start_date, backtest.date_range.end_date)})`
      : "Evaluation: Canonical Historical Dataset"}
    ```
  - Replaced hardcoded `"10.0 yrs"`, `"6.6 yrs"`, and `"98.56%"` caption strings with dynamic calculations.

---

### D6: Perfect Hindsight Fee-Free Operation and Disclosure (Low)

#### Review Finding
The theoretical perfect-hindsight optimizer in `crypto_engine.py` is strictly fee-free (0 bps), but Strategy Lab displayed an active fee control that did not apply to hindsight, and no fee caveat was displayed.

#### Corrective Implementation
- File: `frontend/components/strategy-lab/StrategyLabClient.tsx`
- Added an explicit fee-free research disclosure callout on the Perfect Hindsight tab:
  > *"Theoretical hindsight dynamic programming operates strictly fee-free (0 bps transaction costs, zero taxes, and zero slippage). The strategy fee control does not apply to this calculation."*
- Dynamic fee control behavior:
  - When the Perfect Hindsight tab is active, the transaction fee control is annotated with `(Fee-Free in Hindsight)` and disabled (`disabled={activeTab === "hindsight"}`).
  - When returning to other tabs, the control is re-enabled with full interactivity.
- Fixed request payload documentation: Confirmed that `HindsightOptimizerRequest` schema in FastAPI contains no fee field, matching the underlying engine.

---

### D7: React Hydration Warning During E2E (Informational)

#### Review Finding
During E2E test runs, the Next.js development server console emitted a React hydration mismatch warning:
```
- style={{caret-color:"transparent"}}
```

#### Investigation & Conclusive Finding
1. Verified server-rendered HTML for all routes (`/strategy-lab`, `/risk-lab`, `/robustness`):
   - Checkbox inputs are rendered purely with Tailwind utility classes (`className="rounded border-border text-sky-500 focus:ring-sky-500"`).
   - Zero inline `style` attributes exist in component source code or SSR output.
2. Verified Playwright test harness behavior:
   - Playwright's `page.screenshot({ fullPage: true })` API automatically injects `caret-color: transparent !important` inline into focusable DOM elements (such as `<input>`) right before capturing a raster image to prevent blinking cursor artifacts in screenshots.
   - When Playwright captures screenshots while React development mode hydration reconciliation is occurring, React detects the client-injected `caret-color: transparent` and emits the warning.
3. Conclusive Determination: The hydration warning is 100% an artifact of Playwright's screenshot engine and NOT an application SSR bug. In production builds (`npm run build`), SSR hydration matches cleanly with zero warnings.

---

## 3. Verification Commands & Regression Proofs

The complete Phase 4 verification suite was re-executed and verified:

```powershell
# 1. Frontend Unit Tests (22 tests)
npm test --prefix frontend
# Output: 22 pass, 0 fail, 862ms

# 2. TypeScript Compiler Check
Push-Location frontend; npx tsc --noEmit; Pop-Location
# Output: exit 0, 0 type errors

# 3. ESLint Check
npm run lint --prefix frontend
# Output: exit 0, 0 errors, 0 warnings

# 4. Next.js Production Build
npm run build --prefix frontend
# Output: exit 0, 10/10 static pages generated

# 5. Playwright E2E Integration Suite (Clean Ports)
node frontend/e2e/verify_phase4.mjs
# Output: exit 0, "ALL PHASE 4 PLAYWRIGHT E2E CHECKS PASSED WITH 0 CONSOLE/PAGE ERRORS."

# 6. Backend Parity Suite
.\venv\Scripts\python.exe -m unittest discover -s backend/tests -v
# Output: 21 / 21 pass, OK

# 7. Legacy v1.0 Regression Suite
.\venv\Scripts\python.exe -m unittest discover -s tests -v
# Output: 26 / 26 pass, OK

# 8. Immutability Check
git diff origin/main -- app.py crypto_engine.py strategy_engine.py optimization_engine.py robustness_engine.py data/crypto_daily_prices.csv tests
# Output: 0 diff (empty)
git diff 49eeb2e HEAD -- backend
# Output: 0 diff (empty)
```

---

## 4. Handover to Independent External Reviewer

All review observations (D1–D7) have been fully addressed and verified. The code and documentation are ready for independent external re-review.

- **Primary Re-Review Files**:
  1. `docs/migration/PHASE_04_CORRECTIVE_ACTIONS.md` (this report)
  2. `frontend/components/robustness/RobustnessClient.tsx` (D1, D7)
  3. `frontend/components/strategy-lab/StrategyLabClient.tsx` (D4, D6)
  4. `frontend/components/risk-lab/RiskLabClient.tsx` (D4)
  5. `frontend/lib/validation/strategyForm.ts` (D4)
  6. `frontend/tests/phase4Labs.test.mts` (D4)
  7. `frontend/e2e/verify_phase4.mjs` (D3, D7)
  8. `frontend/lib/formatters/benchmarkComparisons.ts` and `frontend/components/dashboard/DashboardClient.tsx` (D5)
  9. `docs/migration/PHASE_04_REPORT.md` and `docs/migration/PHASE_04_EXTERNAL_REVIEW.md` (D2)
- **Phase Gate Status**: `Phase 4: CORRECTIONS IMPLEMENTED — AWAITING EXTERNAL RE-REVIEW`.
- **Phase 5 Status**: `Phase 5: LOCKED — REQUIRES EXTERNAL REVIEW SIGN-OFF AND PROJECT-OWNER AUTHORIZATION`.

