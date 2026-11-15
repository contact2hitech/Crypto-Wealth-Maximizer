# Phase 3 Independent External Technical Review — Crypto Wealth Maximizer v2.0

- **Branch**: `v2.0-nextjs-migration` (HEAD `5af8787` at review time)
- **Review date**: 2026-11-15
- **Scope**: Phase 3 only (Dashboard + Markets integration)
- **Verdict**: **APPROVED WITH MINOR OBSERVATIONS** (no blocking defects)
- **Constraints observed**: no project files modified, nothing committed, Phase 4 not started or authorized.

> Purpose of this file: hand-off for a second reviewer. Section 7 lists every check with the exact command or call so it can be re-run independently. Section 8 lists the points I am least certain of and want challenged.

## 1. Executive summary
- Dashboard and Markets use FastAPI as the source of truth; no financial arithmetic found in the frontend.
- Headline numbers reconcile with a live API call and the docs.
- Solana's 1,248 pre-launch nulls are preserved; no forward-fill.
- Most material observation: Dashboard benchmark table compares strategy (from 2016-11-09) with Solana (from 2020-04-10) over different periods, mitigated only by a caption.
- Playwright E2E evidence is only partially verified (ran against pre-existing servers, see 4).
- Several documentation inconsistencies.

## 2. Files and commits inspected
- Commits: `ac7834b` (implementation), `e5ff765`, `d1c1c7c`, `500424c`, `f956064`, `5af8787`; baseline `49eeb2e`; original v1.0 `6b1a6f9`.
- Docs: `docs/migration/{PHASE_03_REPORT,TEST_RESULTS,KNOWN_ISSUES,PROJECT_STATUS,CURRENT_PHASE,NEXT_ACTIONS}.md`
- Frontend: `components/dashboard/DashboardClient.tsx`, `components/markets/MarketsClient.tsx`, `lib/charts/downsample.ts`, `lib/constants/referenceConfig.ts`, `lib/api/endpoints.ts`, `components/common/DataTable.tsx`, `e2e/verify_phase3.mjs`, `tests/phase3Helpers.test.mts`
- Backend: `backend/services/common.py` (`map_benchmark_curve`, `STANDARD_LIMITATIONS`), `backend/services/market_service.py`, `backend/services/backtest_service.py`, `backend/schemas/backtests.py`

## 3. Findings

### Critical
None.

### Minor
1. **Different benchmark periods on Dashboard.** Strategy (2016-11-09 →) vs Solana buy-and-hold (2020-04-10 →) in one table. Solana CAGR 98.56% appears above strategy 81.89% on non-comparable windows. Only caption at `DashboardClient.tsx` (~line 802) discloses it. Markets has the proper common-start chart.
2. **Distorted time axis.** `downsampleByExtrema` output has uneven spacing (measured gaps 1–31 days); charts use a categorical `XAxis dataKey="date"` and `type="monotone"`, so spacing and interpolation are visually distorted. Not confirmed visually; derived from code plus a synthetic run.
3. **E2E reproducibility.** `e2e/verify_phase3.mjs` continues when ports 3000/8000 are occupied (my run printed `EADDRINUSE`, then "Servers ready" and passed), so it may test stale servers. Assertions use hardcoded values.
4. **Config card partly hardcoded.** Shows `REFERENCE_BACKTEST_CONFIG` constants, not backend-echoed `configuration`; "Cash Filter: On" and "Warmup: Eval window" are literals. Request `end_date` is `2026-11-10` but data ends `2026-11-09`; will go stale on dataset update.
5. **No in-sample label** beside Dashboard KPIs (full-sample result of a configuration chosen in research). Backend limitations list mentions the negative 2025–2026 Test period.
6. **Doc inconsistencies.** Backend test time 68.003 s (`PHASE_03_REPORT.md`) vs 143.648 s (`TEST_RESULTS.md`); v1.0 suite 50.605 s vs 114.434 s; "9 KPIs" vs 8 rendered cards (Switches/Cash Days is one card); `PROJECT_STATUS.md` dated 2026-11-14 vs 2026-11-12 elsewhere.
7. **Stray untracked root `package-lock.json`** (`"packages": {}`), present before the review.
8. **Test gap.** Unit tests cover helpers only; no component-level tests for the two clients.

## 4. Testing evidence (executed by me, 2026-11-15)
| Suite | Result | Notes |
|---|---|---|
| Frontend unit (`npm test` in `frontend/`) | 11/11 pass | |
| `npx tsc --noEmit` | exit 0 | |
| `npm run lint` | exit 0 | |
| `npm run build` | pass, 10/10 static pages | |
| Backend (`venv\Scripts\python.exe -m unittest discover -s backend/tests -v`) | 21/21 OK, 185.9 s | |
| v1.0 (`... -s tests -v`) | 26/26 OK, 139.4 s | |
| Playwright (`npm run test:e2e --prefix frontend`) | "ALL ... PASSED, 0 errors" | **Caveat:** ports 3000/8000 were already in use (EADDRINUSE); it ran against servers I did not start. Not rerun on clean ports. |

Not independently verified: screenshots, mobile layout visuals, report's claimed timings.

## 5. Financial integrity evidence (live API, backend on :8000)
- `POST /api/backtest/run` with reference config: final `585970.4634620948`, total return `39492.59888…%`, max DD `-69.9385…%`; 3653 equity points; Bitcoin benchmark final `152438.667`.
- Benchmark curves: Bitcoin 3653 pts, Ethereum 3653, **Solana 2405 starting 2020-04-10**.
- `GET /api/markets/prices` (full range): 3653 rows, 2405 non-null Solana, `common_start_date` 2020-04-10; common-start indices all `100.0` on that date; pre-2020-04-10 Solana `null`.
- Pre-overlap window (2017-01-01..2019-12-31): `common_start_date: null`, handled by empty state.
- Reversed, out-of-range and malformed dates → HTTP 422.
- Grep of both clients and formatters: only `toFixed`/unit scaling for labels; no returns, drawdowns or cumulative maths.
- Downsample synthetic run (3653 pts, 2 series, one null for first 1248): 343 points (<450), Solana onset index 1248 and preceding null 1247 retained, gaps 1–31.

## 6. Scope and regression
- `git diff 49eeb2e HEAD --stat -- backend app.py crypto_engine.py strategy_engine.py optimization_engine.py robustness_engine.py requirements.txt tests data` → empty (unchanged). Same against `6b1a6f9` for v1.0 files.
- Non-doc changes since `49eeb2e`: 20 files, all frontend (+ `.gitignore`, `package.json`, lockfile).
- Phase 4 routes (`/strategy-lab`, `/risk-lab`, `/robustness`, `/reports`) remain Phase 2 placeholders.

## 7. How to reproduce
```powershell
# frontend
Push-Location frontend; npm test; npx tsc --noEmit; npm run lint; npm run build; Pop-Location
# backend and v1.0
.\venv\Scripts\python.exe -m unittest discover -s backend/tests -v
.\venv\Scripts\python.exe -m unittest discover -s tests -v
# e2e (stop anything on ports 3000 and 8000 first!)
npm run test:e2e --prefix frontend
# scope check
git diff 49eeb2e HEAD --stat -- backend app.py crypto_engine.py strategy_engine.py optimization_engine.py robustness_engine.py requirements.txt tests data
```

## 8. Points for the second reviewer to challenge
- Re-run E2E on clean ports and confirm it passes against the committed code.
- Visually inspect Dashboard/Markets charts for the time-axis distortion (finding 2) and Solana onset rendering.
- Decide whether finding 1 should be elevated to blocking (benchmark comparability requirement).
- Confirm whether in-sample labelling (finding 5) is required by the migration plan (`docs/migration/MASTER_MIGRATION_PLAN.md`; I did not check it against that document).

## 9. Required corrective actions
None blocking. Recommended: common-period benchmark view or explicit note on Dashboard; E2E fail-fast on occupied ports; reconcile timing figures across docs.

## 10. Final verdict
**APPROVED WITH MINOR OBSERVATIONS.** Proceeding to Phase 4 still requires explicit project-owner approval; this review does not grant it.
