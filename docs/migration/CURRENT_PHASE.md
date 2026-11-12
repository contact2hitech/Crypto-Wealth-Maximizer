# Current Phase — Phase 3: Dashboard and Markets Integration

- **Phase**: `PHASE 3`
- **Status**: `COMPLETED — AWAITING EXTERNAL REVIEW`
- **Branch**: `v2.0-nextjs-migration`
- **Authorized By**: External Technical Review (`Phase 2 Approved`, `2026-11-12`)

## Phase 3 Objective
Integrate `/dashboard` and `/markets` with the existing FastAPI backend endpoints (`POST /api/backtest/run`, `GET /api/markets/prices`, `GET /api/markets/summary`) using Recharts visualizations, backend-computed KPIs and tables, date-range query filtering, pagination for large tables, extrema-preserving chart decimation for responsive rendering, and full research/provenance disclosures without duplicating financial logic in TypeScript.

## Task Checklist
- [x] Add canonical v1.0 reference configuration (`frontend/lib/constants/referenceConfig.ts`) and extrema-preserving chart sampling helper (`frontend/lib/charts/downsample.ts`).
- [x] Enhance `DataTable` (`frontend/components/common/DataTable.tsx`) with optional `pageSize` pagination for large tables (switching history & crossovers).
- [x] Integrate `/dashboard` (`DashboardClient.tsx`) with `POST /api/backtest/run` (`include_daily_trace: false`) and `GET /api/markets/summary`: all 9 KPIs, Recharts Equity Curve vs BTC/ETH/SOL benchmarks (Linear/Log toggle), Daily Underwater Drawdown chart, Ending Allocation, Configuration Summary, Market Overview, Benchmark Table, Paginated Switch History, and Research Warnings.
- [x] Integrate `/markets` (`MarketsClient.tsx`) with `GET /api/markets/prices` and `GET /api/markets/summary`: Latest Close Cards, Date-Range Controls + Presets + Validation, Historical USD Prices, Normalized Performance (`100 = first obs`), Common-Start Comparison (`2020-04-10 = 100`, `connectNulls={false}`), Buy-and-Hold Table, Paginated Crossovers Table, Per-Asset Data Quality Audit Table, and Ethereum/Solana Provenance Disclosures.
- [x] Add Phase 3 unit tests (`frontend/tests/phase3Helpers.test.mts`) and run full Playwright end-to-end verification against live FastAPI + Next.js dev.
- [x] Verify `npm test` (`6/6`), `npx tsc --noEmit`, `npm run lint`, `npm run build`, `backend/tests` (`21/21`), and `tests` (`26/26`).

## Exit Gate Status
- All Phase 3 Dashboard, Markets, and regression checks passed.
- Paused here after pushing to `v2.0-nextjs-migration` awaiting external review in `docs/migration/NEXT_ACTIONS.md` before beginning Phase 4.
