# Next Actions — Phase 2 Review Gate & Phase 3 Preparation

## Authoritative Gate Status
- **Status**: `AWAITING_EXTERNAL_REVIEW`
- **Current Phase Completed**: Phase 2 (Next.js Frontend Foundation + Strict Mode Health Lifecycle Fix)
- **Next Phase**: Phase 3 (Dashboard and Markets Integration)
- **Instruction**: Do **not** begin Phase 3 integration until Phase 2 has been reviewed and Phase 3 is explicitly approved in this file (or explicit user approval is received).

---

## Phase 2 Review Corrections Completed
1. Fixed React Strict Mode `useApiHealth` lifecycle in `frontend/hooks/useApiHealth.tsx` via `HealthCheckCoordinator` (`frontend/lib/api/healthLifecycle.ts`) with monotonic `latestRequestId`, synchronous `activeRequest` invalidation + abort on cleanup, request-identity-guarded `finally`, and visibility-aware `20s` polling.
2. Added focused unit tests (`frontend/tests/healthLifecycle.test.mts`, `3 / 3` passing).
3. Verified Strict Mode health lifecycle, 0 duplicate `/api/health` calls across all 6 routes, `API Offline` transition when stopping FastAPI, `API Connected` recovery on Retry, and desktop/mobile responsive navigation in headless Microsoft Edge via Playwright (`0` console/page errors).

---

## Proposed Phase 3 Scope (Subject to External Approval)

When approved to proceed to Phase 3, execute the following tasks on branch `v2.0-nextjs-migration`:

1. **Dashboard Integration (`/dashboard`)**:
   - Connect to `POST /api/backtest/run` using the v1.0 reference configuration (`Strategy A: 90-day momentum`, `$1,480`, `Monthly`, `30` min hold, `10%` threshold, `10 bps` fee, `20%` DD protection, `0%` recovery, `Invest immediately in Bitcoin`).
   - Display backend-computed KPIs, Recharts equity curve vs buy-and-hold benchmarks, daily underwater drawdown chart, current/selected asset allocation, and research warnings.

2. **Markets Integration (`/markets`)**:
   - Connect to `GET /api/markets/prices` and `GET /api/markets/summary`.
   - Render latest close cards (`Bitcoin`, `Ethereum`, `Solana`), date-range controls (`start_date`, `end_date`), historical USD price chart, normalized performance (`100 = first observation`), common-start three-asset comparison (`2020-04-10 = 100`), crossover table, buy-and-hold summary table, and per-asset data quality audit table.
   - Preserve `null` pre-`2020-04-10` Solana points cleanly (`connectNulls={false}`).

3. **Phase 3 Verification Gate**:
   - All Dashboard & Markets figures reconcile identically with FastAPI / v1.0 outputs.
   - Date-range filtering and error/loading/empty states verified end-to-end.
   - `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, `backend/tests` (`21/21`), and `tests` (`26/26`) all pass.
