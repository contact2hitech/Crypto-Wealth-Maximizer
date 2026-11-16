# Current Phase — Phase 4: Strategy Lab, Risk Lab and Robustness Integration

- **Phase**: `PHASE 4`
- **Status**: `IN PROGRESS`
- **Branch**: `v2.0-nextjs-migration`
- **Authorized By**: Project Owner Formal Approval & External Technical Review (`2026-11-16`)
- **Phase 3 Gate**: Formally Approved and Closed (Reviewed commit `3e814a5`, closure verification commit `dca3fad`, verdict `ACCEPTED`)

## Phase 4 Objective
Implement three fully functional Next.js App Router modules:
1. **Strategy Lab** (`/strategy-lab`): Interactive parameter controls, `POST /api/backtest/run`, `POST /api/backtest/compare`, `POST /api/backtest/practical`, and `POST /api/backtest/hindsight` (strictly labeled as non-investable upper bound), continuous numeric time-scale equity curves, 4-mode protection comparisons, Strategy A/B/C baseline comparison, and paginated trade history.
2. **Risk Lab** (`/risk-lab`): Connect to `POST /api/risk/protection` (`include_daily_trace: true`), displaying maximum drawdown, annualized volatility, Sharpe ratio, daily underwater drawdown area chart, protection exit counts, average/median/worst exit drawdown, trigger overshoot analysis, paginated execution trace, and daily-close vs intraday stop disclosures.
3. **Robustness** (`/robustness`): Connect to `POST /api/robustness/analyze`, displaying fixed-period walk-forward analysis across Development (2016–2022), Validation (2023–2024), and Test (2025–2026) periods (honestly highlighting negative Test results), causal Bitcoin market regimes, asset exposure attribution, protection exit summary, and the predeclared 3×3 parameter sensitivity grid.
4. **Deferred Phase 3 Review Polish**: Replace hardcoded Solana date strings with backend-derived metadata, centralize `horizon_years` sourcing, and extract the benchmark comparison row builder into `frontend/lib/formatters/benchmarkComparisons.ts` with direct unit tests.

## Task Checklist
- [ ] Address three deferred Phase 3 review observations in `frontend/lib/formatters/benchmarkComparisons.ts`, `DashboardClient.tsx`, and `dashboardMarkets.test.mts`.
- [ ] Implement Strategy Lab (`/strategy-lab`, `StrategyLabClient.tsx`):
  - [ ] Configuration panel with validated controls matching backend schemas.
  - [ ] Reset to reference configuration and Run Backtest actions.
  - [ ] Connect to `POST /api/backtest/run`, `POST /api/backtest/compare`, `POST /api/backtest/practical`, and `POST /api/backtest/hindsight`.
  - [ ] Strategy performance KPIs and equity curve with BTC/ETH/SOL benchmarks on numeric time axis.
  - [ ] 4-mode protection comparison table and practical strategy baseline table.
  - [ ] Perfect-hindsight upper bound card with prominent `PERFECT HINDSIGHT — NON-INVESTABLE UPPER BOUND` warning.
  - [ ] Paginated switching history (`pageSize=10`) and cash allocation summary.
- [ ] Implement Risk Lab (`/risk-lab`, `RiskLabClient.tsx`):
  - [ ] Connect to `POST /api/risk/protection` with `include_daily_trace: true`.
  - [ ] Max drawdown, volatility, Sharpe, cash days, and exit summary KPIs.
  - [ ] Daily underwater drawdown area chart with continuous numeric time axis.
  - [ ] Trigger overshoot and gap analysis table.
  - [ ] Paginated protection diagnostics and daily drawdown execution trace tables.
  - [ ] Explicit disclosures regarding daily-close execution, intraday gaps, and transaction friction.
- [ ] Implement Robustness (`/robustness`, `RobustnessClient.tsx`):
  - [ ] Connect to `POST /api/robustness/analyze`.
  - [ ] Walk-forward fixed research periods table honestly displaying negative Test-period results.
  - [ ] Causal Bitcoin market regimes table and metrics.
  - [ ] Asset exposure & return attribution table.
  - [ ] Predeclared 3×3 parameter sensitivity grid.
  - [ ] Limitations and methodology disclosures.
- [ ] Add unit tests for Strategy Lab, Risk Lab, and Robustness transformations (`frontend/tests/`).
- [ ] Extend Playwright E2E test harness (`frontend/e2e/verify_phase4.mjs`) to verify all three routes, interactive runs, chart rendering, mobile layouts, and clean-port safety.
- [ ] Run full regression suite: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm run test:e2e`, `backend/tests` (`21/21`), and `tests` (`26/26`).
- [ ] Verify zero backend/engine/CSV modifications.
- [ ] Create `docs/migration/PHASE_04_REPORT.md` and update all migration tracking documentation.

## Phase Gate Status
- Phase 3: FORMALLY APPROVED AND CLOSED (`2026-11-16`).
- Phase 4: IN PROGRESS (`2026-11-16`).
