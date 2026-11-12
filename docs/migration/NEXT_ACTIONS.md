# Next Actions — Phase 2 Review Gate & Phase 3 Preparation

## Authoritative Gate Status
- **Status**: `AWAITING_EXTERNAL_REVIEW`
- **Current Phase Completed**: Phase 2 (Next.js Frontend Foundation)
- **Next Phase**: Phase 3 (Dashboard and Markets Integration)
- **Instruction**: Do **not** begin Phase 3 integration until Phase 2 has been reviewed and Phase 3 is authorized in this file (or explicit user approval is received).

---

## Proposed Phase 3 Scope (Subject to Reviewer Confirmation)

When approved to proceed to Phase 3, execute the following tasks on branch `v2.0-nextjs-migration`:

1. **Dashboard Integration (`/dashboard`)**:
   - Connect to `POST /api/backtest/run` using the v1.0 reference configuration (`Strategy A: 90-day momentum`, `$1,480`, `Monthly`, `30` min hold, `10%` threshold, `10 bps` fee, `20%` DD protection, `0%` recovery, `Invest immediately in Bitcoin`) with selector controls for strategy/initialization or live refresh.
   - Display backend-computed KPIs: initial capital, final portfolio value, total return, CAGR, maximum drawdown, Sharpe ratio (`rf=0`), switches, cash days, and active configuration summary.
   - Render Recharts equity curve vs buy-and-hold benchmark comparison (`Bitcoin`, `Ethereum`, `Solana`), daily underwater drawdown chart, current/selected asset allocation summary, historical market overview, and research warnings.
   - Downsample or cleanly window dense 3,653-point chart arrays strictly for responsive SVG rendering without altering any backend numbers or calculating metrics in TypeScript.

2. **Markets Integration (`/markets`)**:
   - Connect to `GET /api/markets/prices` and `GET /api/markets/summary`.
   - Render latest close cards (`Bitcoin`, `Ethereum`, `Solana`), date-range controls (`start_date`, `end_date`), historical USD price chart, individual normalized performance (`100 = first observation`), common-start three-asset comparison (`2020-04-10 = 100`), crossover table, buy-and-hold summary table, and per-asset data quality audit table (`valid_observations`, `missing_observations`, `non_positive_prices`, `outliers_over_50pct`).
   - Preserve `null` pre-`2020-04-10` Solana points cleanly (`connectNulls={false}` in Recharts) with explicit pre-launch disclosure.

3. **Phase 3 Verification Gate**:
   - All Dashboard & Markets figures match FastAPI / v1.0 backend responses identically.
   - Date-range filtering works end-to-end and handles invalid/empty ranges gracefully.
   - Loading, error, and empty states verified; zero mock financial figures remain.
   - `npx tsc --noEmit`, `npm run lint`, `npm run build`, `backend/tests` (`21`), and `tests` (`26`) all pass.
