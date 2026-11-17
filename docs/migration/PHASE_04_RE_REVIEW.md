# Phase 4 Re-Review — Verification of Corrective Actions

- **Reviewer:** Claude (independent external reviewer)
- **Branch:** `v2.0-nextjs-migration`
- **Reviewed commit (HEAD):** `39404cb` (corrections: `802a92d`, `54f2dbe`, `84655c1`, `39404cb`)
- **Prior review:** `PHASE_04_EXTERNAL_TECHNICAL_REVIEW.md` (commit `6f18264`, reviewed `cc002e6`, verdict REJECTED)
- **Scope:** Verify D1–D7 only. No implementation file was modified by this re-review.

## 1. Verdict

**APPROVED WITH MINOR OBSERVATIONS.**

All blocking defects (D1–D4) are resolved and independently verified. Remaining observations are Low/Informational and do not block closure of Phase 4. Moving to Phase 5 still requires the project owner's explicit authorization.

## 2. Evidence I executed on `39404cb`

| Check | Result |
|---|---|
| Frontend unit tests (`node --test`) | 22/22 pass |
| `tsc --noEmit` | exit 0 |
| ESLint | exit 0 |
| `next build` | success, 10/10 pages |
| Backend `unittest` (`backend/tests`) | 21/21 pass |
| v1.0 `unittest` (`tests`) | 26/26 pass |
| Phase 4 Playwright E2E (`test:e2e`) | exit 0, 0 page errors, 0 console errors |
| Protected files (`backend/`, `app.py`, 4 engines, `requirements.txt`, `tests/`, `data/`, `validate_*.py`) `git diff 4ab461b HEAD` | empty |
| Live API reconciliation (backend started by me) | matches corrected figures (below) |
| Robustness screenshot `phase4_robustness_desktop.png` (viewed) | fully loaded tables, live banner |

Not executed or not verified by me: mobile screenshots, Strategy Lab / Risk Lab screenshots (covered only by E2E text assertions), and a production-mode browser run.

## 3. Defect-by-defect verification

| ID | Original | Status | Evidence |
|---|---|---|---|
| D1 High | Hardcoded `+83.67%`, `-24.96%`/`-0.46` fallbacks, unsupported causal claim | **Resolved** | Banner is now rendered only when `robustnessData && testPeriod`; a neutral loading state is shown otherwise. Dev/Val/Test CAGR, window dates, total return and Sharpe all come from the API. The causal "range-bound chop" claim is removed. Screenshot shows 134.71% / 82.05% / -21.74% / -0.46 consistent with the table. |
| D2 High | Reported figures did not reproduce | **Resolved** | My live API run: Compare A/B/C/D = $2,668,905.12 / $661,870.95 / $585,970.46 / $5,100,729.25; Practical A/B/C = $4,357,408.61 / $2,724,582.89 / $660,608.36; Hindsight K=5 = $552,814,299.71; Risk 40 exits, worst exit -40.26% (2020-09-05), max overshoot 20.26 pp; walk-forward 134.71 / 82.05 / -21.74. These equal the corrected documents and E2E assertions. |
| D3 Medium | E2E passed on fallback text | **Resolved** | E2E now waits for table values (`134.71%`, `82.05%`, `-21.74%`, `$939.53`) and asserts live Compare, Practical, Hindsight and Risk figures. Fallback text no longer exists in the source, so a false pass on it is impossible. |
| D4 Medium | Circular unit tests | **Mostly resolved** | Tests now import production code (`lib/validation/strategyForm.ts`, `calculateHorizonYears`, `downsampleByExtrema`), and both Lab components call the shared validators. See R1. |
| D5 Low | Phase 3 literals | **Resolved for the flagged items** | `resolveSolanaStartDate` returns `null` instead of `"2020-04-10"`; Dashboard evaluation range, notice and caption derive from the response; `98.56%`/`6.6 yrs`/`10.0 yrs` fallbacks removed. See R3. |
| D6 Low | Hindsight fee-free not disclosed | **Resolved** | Fee select disabled on the hindsight tab with a "(Fee-Free in Hindsight)" label, plus an explicit fee/slippage caveat; E2E asserts the text. |
| D7 Info | Hydration warning | **Explained** | The E2E log shows the only diff is an injected `style={{caret-color:"transparent"}}` on checkboxes, consistent with the Playwright artifact. Run reports 0 console errors. |

## 4. Remaining observations (non-blocking)

- **R1 (Low):** `calculateExitOvershoot` and `isHindsightNonInvestable` are used only by the tests, not by any production code, so two of the six tests verify helpers the UI never calls. The overshoot value shown in the UI comes from the backend. Either use them in the components or remove them and cover the UI behaviour through E2E.
- **R2 (Low):** The Robustness banner is data-driven but its wording is still fixed: it always says "dropped to" / "severe deterioration" and the title says "Deterioration". If a future Test period were positive, the text would be wrong. `formatPercent(valPeriod?.cagr_pct ?? 0)` would also print `0.00%` if the Validation row were missing, instead of a dash. The partition-boundary sentence is static text.
- **R3 (Low):** `DashboardClient.tsx:222` still contains the literal "Partial Window (Starts 2020-04-10)". Markets-page text mentions the same date as static copy.
- **R4 (Informational):**
  - The Risk validation message says "between 1% and 100%", but the code accepts any value above 0 and up to 100, so 0.5 passes.
  - The 50 ms mount delay in `RobustnessClient` is a workaround whose purpose is not documented.
  - `PHASE_04_CORRECTIVE_ACTIONS.md` says the hydration warning is "100%" a Playwright artifact and that production builds hydrate with zero warnings. I did not run a production-mode browser test, so that is stated more strongly than the evidence supports.

## 5. Recommendation

Phase 4 may be closed by the project owner. R1–R4 can be fixed as low-priority cleanup in Phase 5 or earlier. Phase 5 and Phase 6 remain locked until the owner authorizes them. This re-review did not merge to `main`, deploy, or change implementation code, data or Python engines.
