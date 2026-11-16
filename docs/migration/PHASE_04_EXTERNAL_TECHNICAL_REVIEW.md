# Phase 4 External Technical Review — Crypto Wealth Maximizer v2.0

## 1. Executive verdict

**REJECTED — corrections required before project-owner closure.**

The financial engines, FastAPI backend, dataset and v1.0 files are untouched and correct, and every suite I ran passes. The rejection is not about the calculations. It rests on the integrity of what Phase 4 presents and reports:

1. A user-facing research-honesty banner on `/robustness` contains a hardcoded, wrong statistic (`+83.67% CAGR`) and hardcoded fallback figures (`-24.96%`, `-0.46`) that disagree with the backend.
2. The review package, and the reports it summarises, state "reconciled" figures for five endpoints that I could not reproduce from the live API or the Python engines.
3. The Phase 4 E2E "pass" and the Phase 4 unit tests do not test what they claim to.

Each item is small to fix, but together they mean the gate evidence cannot be trusted as written. Re-review after correction should be quick.

## 2. Scope and exact commit reviewed

- **Repository / branch**: `contact2hitech/Crypto-Wealth-Maximizer`, `v2.0-nextjs-migration`
- **Commit reviewed**: `cc002e61be95a54415239bfad789a007e96d3b17` (`cc002e6`, docs: prepare Phase 4 external technical review package). Implementation commit: `0e411f0`. Previous gate: `4ab461b` (Phase 3 approval).
- **Scope**: Strategy Lab, Risk Lab, Robustness, shared frontend, the backend endpoints they call, the Python engines they depend on, the dataset, and the deferred Phase 3 observations.
- **Reviewer limits**: I did not modify implementation code, start Phase 5/6, merge, or deploy. The only file I added is this report. The working tree also had a one-line, uncommitted trailing-newline change to `docs/migration/PHASE_04_EXTERNAL_REVIEW.md` that was not mine; I left it alone and did not commit it.

## 3. Architecture and implementation assessment

- Data flow is clean: the Next.js clients call typed `apiClient` methods, FastAPI services wrap `optimization_engine.py` / `robustness_engine.py`, and the frontend renders the returned rows.
- No financial arithmetic was found in the Phase 4 frontend. A grep of `frontend/components` and `frontend/lib` for `Math.`, `* 100`, `reduce` and similar found only formatting, `toFixed`, date conversion, and `Math.abs` for placing the stop-trigger reference line.
- Overshoot, exit statistics and walk-forward metrics all come from the backend (`exit_metrics`, `drawdown_exits[].overshoot_beyond_configured_trigger_pp`).
- Weak points are in what surrounds the calculations (hardcoded text, tests, reporting), not in the calculation path.

## 4. Strategy Lab findings

| Check | Result |
|---|---|
| Run / compare / practical / hindsight tabs call the four endpoints | Verified in code (`StrategyLabClient.tsx`) |
| Comparison table renders backend rows directly (`compareRes.comparison`) | Verified; displayed figures are the engine's |
| Hindsight flags | Verified live: `is_hindsight_upper_bound: true`, `is_investable: false`, with a backend warning string |
| Equity charts use a numeric `scale="time"` axis with `type="linear"` | Verified in code |
| Hindsight result presented without a fee caveat | **See D6.** The engine is fee-free ("No fees, taxes or slippage", `crypto_engine.py`) while the lab's fee control does not apply to it. |
| Practical baseline | Backend text says always fully invested, no cash filter or drawdown stop, no look-ahead. Consistent with the engine. |

Observation (Informational): with the reference settings, the engine shows the less-protected modes ending far higher in final value (see D2 table: A $2.67M, D $5.10M) than the Combined mode ($586k), with deeper drawdowns. That is a legitimate trade-off, but I did not verify that the UI explains it.

## 5. Risk Lab findings

- Connected to `POST /api/risk/protection` with `include_daily_trace: true`. Live response: 3,653 trace rows, 95 diagnostics, 40 drawdown exits.
- Overshoot values are backend-supplied, not frontend-computed. This is correct.
- The exit statistics in the review package do not match the live backend (**D2**). The UI renders live values, so the Risk Lab screen itself is likely correct. I did not visually inspect the Risk Lab chart or trace screenshots.
- The package (§7 item 3) says the page cites March 2020 and May 2021 flash crashes and `-35.81%` / `15.81 pp`. I found none of those strings in `frontend/components` or `frontend/lib`.

## 6. Robustness findings

**Verified live** (`POST /api/robustness/analyze`):

- Fixed periods are correct: Development 2016-11-09 → 2022-12-31, Validation 2023-01-01 → 2024-12-31, Test 2025-01-01 → 2026-11-09.
- The backend response states these are independent periods with indicator warm-up only up to each period end (no look-ahead).
- The Test period is negative: CAGR -21.74%, total return -36.52%, Sharpe -0.46, max drawdown -52.02%.

**Defects:** the honesty banner contains wrong hardcoded numbers (**D1**), and the E2E assertion for it is a false pass (**D3**).

Not verified: the regime table values, the attribution values, and the grid contents beyond the backend test that checks nine sensitivity combinations.

## 7. Financial correctness and data-integrity findings

- **Engine logic read** (`optimization_engine.py::run_constrained_backtest`): signals use close-t data, the return applies to t→t+1 via `pct_change(fill_method=None)`, fees are charged per switch, drawdown exits are checked daily, the peak resets on re-entry, and a missing asset return is treated as 0 rather than forward-filled. No look-ahead or leakage found.
- **Solana**: the live market data keeps 1,248 pre-launch nulls. The engine does not fill them, and the frontend uses `connectNulls={false}`.
- **Hindsight**: clearly flagged non-investable in the response; fee-free (D6).
- **Protected files**: `git diff 4ab461b cc002e6` over `backend/`, `app.py`, the four engines, `requirements.txt`, `tests/`, `data/`, `validate_*.py` is empty.
- **Engine outputs differ from the package's quoted figures** — see D2. Whichever side is right, the package's "reconciled" labels are false.

## 8. Testing and QA results

All rows below are tests I executed myself on `cc002e6`, with ports 3000 and 8000 confirmed free before the E2E run.

| Suite | Result |
|---|---|
| Frontend unit (`npm test --prefix frontend`) | 22/22 pass |
| `npx tsc --noEmit` | exit 0 |
| `npm run lint --prefix frontend` | exit 0 |
| `npm run build --prefix frontend` | pass, 10/10 static pages |
| Playwright E2E (`node frontend/e2e/verify_phase4.mjs`) | exit 0, "0 console/page errors" — but see D3 |
| Backend (`unittest discover -s backend/tests`) | 21/21 OK, 98.7 s |
| v1.0 (`unittest discover -s tests`) | 26/26 OK, 55.4 s |
| Live API reconciliation (run, compare, practical, hindsight, risk, robustness) | Executed; five of six endpoints disagree with the package (D2) |

Not executed or verified: mobile layouts and the Strategy Lab and Risk Lab screenshots (the Robustness desktop screenshot was inspected), responsive overflow beyond what the harness asserts, and the report's quoted timings.

## 9. Security and reliability observations

- Standard timeouts and abort handling carried over from earlier phases. I did not perform a separate security audit of CORS, the cache or input limits; the backend tests that cover validation pass.
- Cold calls to compare and practical are slow, as documented (KI-017). I did not measure them.
- During the E2E run the dev server logged a React hydration-mismatch warning for a `caret-color: transparent` inline style on form checkboxes. That attribute is most likely injected by Playwright screenshot options, so it is probably a harness artifact rather than an app defect, but I did not confirm the cause. The harness still printed "Console errors: 0".

## 10. Defects

| ID | Severity | Defect |
|---|---|---|
| D1 | **High** | Hardcoded, incorrect statistic in a user-facing research-honesty banner |
| D2 | **High** | Review package and phase reports state "reconciled" figures that do not reproduce |
| D3 | **Medium** | Phase 4 E2E passes on hardcoded fallback text, so it does not verify live data |
| D4 | **Medium** | Phase 4 unit tests re-implement logic inline with invented mock data |
| D5 | **Low** | Deferred Phase 3 hardcoded literals are only partly removed; package says "eliminated" |
| D6 | **Low** | Hindsight upper bound is fee-free, but this is not disclosed and the fee control does not apply |
| D7 | **Informational** | Hydration warning logged during E2E; probable harness artifact |

### D1 — Hardcoded, incorrect statistic in the Robustness honesty banner (High)

`frontend/components/robustness/RobustnessClient.tsx`:

- Line 655: the banner states "Historical in-sample Development performance (+83.67% CAGR)". The live Development CAGR is **134.71%**. The figure 83.67 appears nowhere in the backend response or the repository's research documents.
- Lines 646 and 653: fallbacks `"-24.96%"` and `"-0.46"` are shown whenever the response is not yet loaded or the Test row is missing. The live Test CAGR is **-21.74%** (Sharpe -0.46 matches).
- The same banner asserts the cause: "range-bound chop, false breakouts, and lack of sustained asset trends". Nothing in the backend supports that causal claim.
- The banner is unconditional, so it describes the reference configuration regardless of the strategy or protection toggles the user selected on the same page.

Evidence: the live API call above; `grep -rn "83\.67" frontend docs` hits only this line.

### D2 — Reported figures that do not reproduce (High)

I called each endpoint with the reference configuration used in the package (Strategy A, Monthly, 30d hold, 10% threshold, 10 bps, 20% stop, 0% recovery, Invest immediately in Bitcoin, 2016-11-09 → 2026-11-10), and also ran `compare_protection_modes` directly from `optimization_engine.py` on `data/crypto_daily_prices.csv`. The API and the engine agree with each other.

| Item | Package claims (`PHASE_04_EXTERNAL_REVIEW.md` §4–§7) | Live API / engine |
|---|---|---|
| Compare A – Cash filter only | $585,970.46 | **$2,668,905.12** |
| Compare B – Drawdown only | $152,438.67 | **$661,870.95** |
| Compare C – Combined | $585,970.46 | $585,970.46 (matches) |
| Compare D – No protection | $152,438.67 | **$5,100,729.25** |
| Practical A / B / C | $585,970.46 / $53,889.39 / $70,302.73 | **$4,357,408.61 / $2,724,582.89 / $660,608.36** (10 bps, default dates) |
| Hindsight, K=5 | $113,383,230.13, CAGR 228.67% | **$552,814,299.71** (and request has no `transaction_cost_bps` field) |
| Risk: drawdown exits | 14 | **40** |
| Risk: average / worst exit drawdown | -22.84% / -35.81% | **-24.02% / -40.26%** (2020-09-05) |
| Risk: max overshoot | 15.81 pp | **20.26 pp** |
| Walk-forward CAGR Dev / Val / Test | 144.15% / 111.45% / -24.96% | **134.71% / 82.05% / -21.74%** |

The compare B and D figures claimed ($152,438.67) equal Bitcoin buy-and-hold exactly, and A equals C, which is a pattern the engine does not produce.

The UI tables render the backend rows, so the screens are likely right. The defect is that gate evidence claims reconciliation that did not happen. `PHASE_04_REPORT.md` (lines ~124–129) repeats several of these claims; I did not audit `TEST_RESULTS.md` beyond the reference-run figures, which do match.

### D3 — E2E passes on hardcoded fallback text (Medium)

`frontend/e2e/verify_phase4.mjs` line 265 waits for the text `-24.96%`. That string is only the hardcoded loading fallback (D1); the real value after load is `-21.74%`. The saved screenshot `frontend/e2e/screenshots/phase4_robustness_desktop.png` shows the banner with `-24.96%` and `+83.67%` while every table is still a loading skeleton. The harness also only asserts the reference-run total (`$585,970.46`) for Strategy Lab; none of the compare, practical or hindsight figures are checked. The "reconciled with FastAPI" statement for E2E is therefore unsupported.

### D4 — Circular unit tests (Medium)

`frontend/tests/phase4Labs.test.mts` defines `validateStrategyForm` inside the test body, builds mock walk-forward rows with invented values (e.g. Test `cagr_pct: -24.96`, `final_value_usd: 885.12`), and asserts on those same mocks. It imports only `downsampleByExtrema` and types, never a component or the real form logic. These tests would pass if the product code were broken. This is the same pattern flagged in my Phase 3 closure observation 3.

### D5 — Phase 3 deferred observations only partly closed (Low)

- Resolved: horizon years are computed by one helper (`calculateHorizonYears`) and `buildComparisonRows` is extracted into `lib/formatters/benchmarkComparisons.ts` with direct tests that call the real function.
- Not fully resolved: `DashboardClient.tsx` still contains literal fallbacks `"2020-04-10"` (line 187), `"10.0 yrs"` / `"6.6 yrs"` / `"98.56%"` (lines ~845–847, 864), and a static banner `Evaluation: 2016-11-09 → 2026-11-09 (10.0 yrs)` (line 401). `resolveSolanaStartDate` in `benchmarkComparisons.ts` still falls back to `"2020-04-10"`. The package's statement that hardcoded values were "eliminated" is overstated.

### D6 — Hindsight upper bound is fee-free and undisclosed (Low)

`HindsightOptimizerRequest` has no fee field, and `crypto_engine.py::optimal_switching` states "No fees, taxes or slippage". The Strategy Lab fee control (default 10 bps) does not apply to this tab, and the hindsight response has no assumptions list (`assumptions_and_limitations: null`). I found no fee caveat on the tab in `StrategyLabClient.tsx`. The package's claim that the request passed `transaction_cost_bps: 10.0` is not supported by the schema.

### D7 — Hydration warning during E2E (Informational)

See section 9.

## 11. Required corrective actions

| # | Action | Affected files |
|---|---|---|
| 1 | Remove the hardcoded `+83.67%`, `-24.96%`, `-0.46` and the unsupported causal sentence. Drive the banner entirely from the live `walk_forward.periods` rows (Development, Validation, Test), show a neutral state while loading, and state which configuration it describes. | `frontend/components/robustness/RobustnessClient.tsx` (about lines 630–665) |
| 2 | Re-run every endpoint listed in D2, replace the incorrect figures, and re-issue the package and reports with figures traced to a stated request payload. Remove "reconciled" labels that were not checked. | `docs/migration/PHASE_04_EXTERNAL_REVIEW.md`, `PHASE_04_REPORT.md`, `TEST_RESULTS.md`, `PROJECT_STATUS.md` |
| 3 | Fix the E2E to wait for the loaded state (for example the Test row of the walk-forward table) and assert live values, or compare against a direct API call. Add assertions for the compare, practical, hindsight and risk figures. | `frontend/e2e/verify_phase4.mjs` |
| 4 | Replace circular tests with tests that import the real validation and rendering logic, or move that logic into a shared module and test it. Do not assert on invented numbers. | `frontend/tests/phase4Labs.test.mts`, relevant client components |
| 5 | Remove the remaining literal fallbacks, or derive them from backend metadata. | `DashboardClient.tsx`, `lib/formatters/benchmarkComparisons.ts` |
| 6 | Add an explicit "no fees, taxes or slippage" note to the hindsight tab, and disable or annotate the fee control there. | `StrategyLabClient.tsx` |

No change to the Python engines, backend or dataset is required.

## 12. Final recommendation

**Phase 4 is not ready for project-owner closure.** I recommend returning it for corrections 1–4 as blocking, and 5–6 as non-blocking but desirable in the same pass. After correction, a short re-review should confirm: the banner reads from live data, the package figures match the API, and the E2E and unit tests fail if the product text or data is wrong. Phase 5 should stay locked until then; this review does not authorize it.
