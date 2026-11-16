# Test Results — Crypto Wealth Maximizer v2.0 Migration

All results below were directly executed and observed in the local environment (`Windows`, `Python 3.13.9` via `.\venv\Scripts\python.exe`, `Node v24.14.1`, `npm 11.11.0`, `Next.js 16.4.6`).

---

## Phase 4 Verification (Strategy Lab, Risk Lab and Robustness Integration, `2026-11-16`)

### 1. Frontend Unit Tests (`npm test`)
Command (inside `frontend/`):
```powershell
npm test --prefix frontend   # runs: node --test tests/*.test.mts
```
Result: **PASS (`22 / 22` tests in `1.60s`)**:
- `healthLifecycle.test.mts` (`3 / 3`): React Strict Mode lifecycle, stale request protection, deduplication & offline/retry recovery.
- `phase3Helpers.test.mts` (`8 / 8`): Reference config matching, downsample boundary preservation, independent multi-series extrema without scale occlusion, RangeError on non-positive maxPoints, and mandatory-boundary overflow exceptions.
- `dashboardMarkets.test.mts` (`5 / 5`): Chart timestamp formatting, linear monotonicity, dynamic benchmark evaluation periods, Solana partial-window tagging, config fallbacks, and Markets common-start windowing.
- `phase4Labs.test.mts` (`6 / 6`):
  - `Strategy Lab form validation rejects invalid date order and non-positive capital`
  - `Strategy Lab hindsight upper-bound flags preserve non-investable constraints` (`is_hindsight_upper_bound: true`, `is_investable: false`)
  - `Risk Lab exit overshoot calculation accurately measures drawdown beyond daily trigger`
  - `Risk Lab daily trace downsampling preserves worst drawdown troughs within requested budget`
  - `Robustness walk-forward fixed research periods honestly report negative Test period metrics` (Development 144.15%, Validation 111.45%, Test -24.96%)
  - `Robustness 3x3 sensitivity grid contains exactly 9 scenarios covering strategies A, B, and C`

### 2. Frontend TypeScript, ESLint, and Production Build (`frontend/`)
- `Push-Location frontend; npx tsc --noEmit; Pop-Location`: **PASS (exit code 0, 0 errors, 27.5s)**
- `npm run lint --prefix frontend`: **PASS (exit code 0, 0 warnings, 28.0s)**
- `npm run build --prefix frontend`: **PASS (`Next.js 16.4.6 Turbopack`, compiled in 55.0s, TypeScript in 27.5s, 10/10 static pages generated)**
  - Routes: `/`, `/_not-found`, `/dashboard`, `/markets`, `/reports`, `/risk-lab`, `/robustness`, `/strategy-lab`

### 3. Reproducible Playwright End-to-End Integration Verification (`frontend/e2e/verify_phase4.mjs`)
Command:
```powershell
node frontend/e2e/verify_phase4.mjs
```
Executed with automated background service startup on clean, unoccupied ports (verified via pre-flight `checkPortAvailable` for ports 8000 & 3000) against `uvicorn backend.main:app --port 8000` and `npm --prefix frontend run dev -- --port 3000` in headless Microsoft Edge (`msedge.exe`):
- **Strategy Lab (`/strategy-lab`)**:
  - Interactive parameter controls loaded with reference defaults (Strategy A, Monthly, 30d hold, 10% threshold, 10 bps fee, 20% DD stop, 0% recovery, Invest immediately in Bitcoin).
  - Executed all 4 backtest endpoints: `POST /api/backtest/run`, `POST /api/backtest/compare`, `POST /api/backtest/practical`, and `POST /api/backtest/hindsight`.
  - Reconciled 8 KPI cards: `$1,480.00` initial, `$585,970.46` final, `39,492.60%` total return, `81.89%` CAGR, `-69.94%` max DD, `68.43%` volatility, `1.21` Sharpe, `95 / 1,830` switches / cash days.
  - Recharts Equity Curve rendered continuous numeric time scale (`scale="time"`) with BTC, ETH, SOL benchmarks and Linear/Log scale toggle.
  - 4-Mode Protection Table verified (`A – Cash filter only`, `B – Drawdown protection only`, `C – Combined protection`, `D – No cash protection`).
  - Practical Strategy Table verified (`A: 90-day momentum`, `B: 50/200-day trend + momentum`, `C: 30/90/180-day momentum`).
  - Paginated switching history (`Page 1 / 10` -> `Page 2 / 10`) verified.
  - Theoretical Hindsight Upper Bound verified with prominent amber warning banner (`PERFECT HINDSIGHT — NON-INVESTABLE UPPER BOUND`).
- **Risk Lab (`/risk-lab`)**:
  - Connected to `POST /api/risk/protection` with `include_daily_trace: true`.
  - Reconciled 8 risk KPI cards: `-69.94%` max DD, `68.43%` volatility, `1.21` Sharpe, `1,830` cash days, `14` protection exits, `-22.84%` avg exit DD, `-35.81%` worst exit DD, `15.81 pp` max overshoot.
  - Daily Underwater Drawdown area chart rendered on continuous numeric time scale with configured stop trigger reference line (`#f43f5e` dashed).
  - Critical Stop-Loss & Intraday Gap Risk disclosure banner verified.
  - Drawdown Protection Exits & Gap Overshoot Analysis table verified.
  - Daily Drawdown Execution Trace table verified with pagination (`Page 1 / 244` -> `Page 2 / 244`).
- **Robustness (`/robustness`)**:
  - Connected to `POST /api/robustness/analyze`.
  - Strict Research Honesty banner rendered, highlighting out-of-sample Test period performance deterioration (2025–2026 CAGR `-24.96%`, Sharpe `-0.46`).
  - Walk-Forward Independent Partition Periods table verified (Development 2016–2022 CAGR `144.15%`, Validation 2023–2024 CAGR `111.45%`, Test 2025–2026 CAGR `-24.96%`).
  - Causal Bitcoin Market Regimes table verified (Bull Trending, Bear Trending, Sideways/Rangebound).
  - Asset Exposure & Return Attribution table verified (BTC, ETH, SOL, USD Cash).
  - Predeclared 3×3 Parameter Sensitivity Grid verified (9 combinations across Strategies A, B, C × 15%, 20%, 25% drawdown stops).
- **Responsive Mobile Layout (`390x844`)**: Verified on Strategy Lab, Risk Lab, and Robustness with 0 horizontal overflow.
- **Console & Page Errors**: **0 uncaught page errors and 0 console errors**.

### 4. Backend API & Parity Suite Re-run (`backend/tests`)
Command:
```powershell
.\venv\Scripts\python.exe -m unittest discover -s backend/tests -v
```
Result: **PASS (`21 / 21` tests in `133.914s`, `OK`)**

### 5. Existing v1.0 Unit Suite Re-run (`tests`)
Command:
```powershell
.\venv\Scripts\python.exe -m unittest discover -s tests -v
```
Result: **PASS (`26 / 26` tests in `99.172s`, `OK`)**

### 6. Backend & Engine Integrity Check
Command:
```powershell
git diff 6b1a6f9 -- backend app.py crypto_engine.py strategy_engine.py optimization_engine.py robustness_engine.py data/crypto_daily_prices.csv
```
Result: **PASS (0 files modified, 100% untouched)**

---

## Phase 3 Verification (Dashboard and Markets Integration, `2026-11-12` — Review Closure `2026-11-15`)

### 1. Frontend Unit Tests (`npm test`)
Command (inside `frontend/`):
```powershell
npm test   # runs: node --test tests/*.test.mts
```
Result: **PASS (`16 / 16` tests in `1.17s`)**:
- `healthLifecycle.test.mts` (`3 / 3`): Strict Mode lifecycle, stale request protection, deduplication & offline/retry recovery.
- `phase3Helpers.test.mts` (`8 / 8`):
  - `REFERENCE_BACKTEST_CONFIG matches v1.0 FINAL_RESEARCH_REPORT reference settings`
  - `downsampleByExtrema preserves endpoints, series onset, and peak/trough extrema`
  - `downsampleByExtrema preserves independent multi-series multi-scale extrema without occlusion` (Series A $50k-$120k, Series B 2-250, Series C -99.5% to +5% onset at 350; all individual extrema preserved without cross-series scale occlusion; requested maxPoints budget enforced during normal operation)
  - `downsampleByExtrema throws RangeError for zero, negative, or non-integer maxPoints` (throws explicit RangeError rather than silently returning full dataset)
  - `downsampleByExtrema handles maxPoints = 1 by preserving mandatory boundaries without returning complete dataset` (mandatory-boundary overflow exception)
  - `downsampleByExtrema preserves all mandatory boundaries when mandatory point count overflows requested budget` (6 mandatory points retained when maxPoints = 3 under intentional mandatory-boundary overflow exception, not an algorithm failure)
  - `downsampleByExtrema handles mandatory points exceeding requested maxPoints gracefully` (intentional mandatory-boundary overflow exception)
  - `financial formatters return em-dash for null/non-finite values and format numbers cleanly`
- `dashboardMarkets.test.mts` (`5 / 5`):
  - `chartFormatters convert dates to UTC epoch timestamps and format accurately` (validates `dateToUtcTimestamp`, `formatAxisTimestamp`, `formatTooltipTimestamp`, leap-year handling, and non-finite fallbacks)
  - `timestamp sequence is strictly monotonic and proportional to calendar elapsed days` (verifies continuous linear spacing)
  - `benchmark table rows correctly tag Solana partial window and compute evaluation horizons` (verifies 10.0 yr vs 6.6 yr tagging, `is_partial = true` on Solana, and `period_label`)
  - `dynamic configuration fallback resolves to REFERENCE_BACKTEST_CONFIG when response is null`
  - `Markets common-start range filters out observations before common_start_date`

### 2. Frontend TypeScript, ESLint, and Production Build (`frontend/`)
- `Push-Location frontend; npx tsc --noEmit; Pop-Location`: **PASS (exit code 0, 0 errors)**
- `npm run lint --prefix frontend`: **PASS (exit code 0, 0 warnings)**
- `npm run build --prefix frontend`: **PASS (`Next.js 16.4.6 Turbopack`, compiled in `5.8s`, TypeScript in `16.6s`, `10/10` static pages generated in `4.1s`)**

### 3. Reproducible Playwright End-to-End Integration Verification (`npm run test:e2e`)
Command:
```powershell
npm run test:e2e --prefix frontend   # runs: node e2e/verify_phase3.mjs
```
Executed with automated background service startup on clean, unoccupied ports (verified via pre-flight `checkPortAvailable` for ports 8000 & 3000) against `uvicorn backend.main:app --port 8000` and `npm --prefix frontend run dev -- --port 3000` in headless Microsoft Edge (`msedge.exe`):
- **Dashboard (`/dashboard`)**:
  - `/` redirected to `/dashboard`; `API Connected` badge appeared cleanly.
  - In-Sample Retrospective Research Baseline (2016–2026) banner rendered.
  - Benchmark Comparability Notice banner rendered and linked to `/markets`.
  - All backend-computed KPIs rendered and reconciled: `$1,480.00` initial capital, `$585,970.46` final value, `39,492.60%` total return, `81.89%` CAGR, `-69.94%` max drawdown, `68.43%` volatility, `1.21` Sharpe, `95 / 1,830` switches / cash days.
  - Benchmark comparison table rendered `Buy & hold: Bitcoin` (`$152,438.67`), `Buy & hold: Ethereum`, and `Buy & hold: Solana` with `Evaluation Period` column (`2016-11-09 → 2026-11-09` vs `2020-04-10 → 2026-11-09`) and `*Partial Window (Starts 2020-04-10)` badge.
  - Both Recharts `<svg>` charts rendered continuous numeric time axes and linear curves cleanly; Linear/Log scale toggle verified; `Switching History` table pagination (`Page 1 / 10` -> `Page 2 / 10`) verified.
- **Markets (`/markets`)**:
  - Navigating between `Markets` and `Dashboard` triggered `0` duplicate `/api/health` requests (`[health #4]` / `[health #5]` fired only on full `page.goto` reload for mobile check).
  - Latest close cards reconciled: Bitcoin `$74,496.47`, Ethereum `$2,119.10`, Solana `$86.88` (`2026-11-09`); Common-Start Date `2020-04-10`.
  - Data quality audit reconciled: `3,653` valid BTC/ETH observations, `2,405` valid / `1,248` missing pre-launch SOL observations (`0` duplicates, `0` non-positive, `0` moves > 50%); Ethereum pre-`2017-11-09` caveat displayed.
  - All 3 Recharts charts rendered continuous numeric time-scale curves cleanly with `connectNulls={false}`.
  - Date-range filtering verified: `Test Window (2025-2026)` updated range to `2025-01-01 to 2026-11-09 (678 days)`; invalid range (`2025-06-01` > `2025-01-01`) displayed `"Start date must be on or before end date."`; `Reset` restored `2016-11-09 to 2026-11-09 (3,653 days)`.
- **Responsive Mobile (`390x844`) & Errors**: Zero horizontal overflow on desktop (`1280x800`) and mobile (`390x844`) for both `/dashboard` and `/markets`; **`0` uncaught page errors and `0` console errors**.

### 4. Backend API & Parity Suite Re-run (`backend/tests`)
Command:
```powershell
.\venv\Scripts\python.exe -m unittest discover -s backend/tests -v
```
Result: **PASS (`21 / 21` tests in `85.622s`, `OK`)**

### 5. Existing v1.0 Unit Suite Re-run (`tests`)
Command:
```powershell
.\venv\Scripts\python.exe -m unittest discover -s tests -v
```
Result: **PASS (`26 / 26` tests in `59.644s`, `OK`)**

---

## Historical Summaries (Phases 0–2)
- Phase 2 (`2026-11-12`): `npm test` `3/3`, `tsc`/`eslint`/`next build` pass, Playwright Strict Mode + mobile navigation pass, `backend/tests` `21/21`, `tests` `26/26`.
- Phase 1 (`2026-11-11`): `backend/tests` `21/21` (`81.071s`), `tests` `26/26` (`53.418s`), live Uvicorn 10-endpoint benchmark `200/200`.
- Phase 0 (`2026-11-11`): `tests` `26/26` (`71.734s`), `validate_data.py` exit 0, `validate_optimizer.py` exit 0.
