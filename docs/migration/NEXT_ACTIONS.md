# Next Actions — Phase 4 Implementation & Phase 3 Formal Closure

## Authoritative Gate Status
- **Status**: `PHASE_04_IN_PROGRESS`
- **Phase 3**: FORMALLY APPROVED AND CLOSED (`2026-11-16`)
  - External re-review verdict: `ACCEPTED` ([PHASE_03_CLOSURE_VERIFICATION.md](./PHASE_03_CLOSURE_VERIFICATION.md))
  - Reviewed implementation commit: `3e814a5`
  - Closure verification commit: `dca3fad`
  - Project-owner authorization date: `2026-11-16`
- **Phase 4**: AUTHORIZED AND ACTIVE (`2026-11-16`)
  - Scope: Strategy Lab (`/strategy-lab`), Risk Lab (`/risk-lab`), Robustness (`/robustness`)
  - Authority: Project Owner Formal Phase 4 Authorization

---

## Active Phase 4 Implementation Plan

Execute the following tasks sequentially on branch `v2.0-nextjs-migration`:

1. **Resolve Phase 3 Non-Blocking Review Observations**:
   - Dynamic Solana dataset start-date & evaluation-period metadata binding.
   - Sourcing `horizon_years` cleanly from backend metadata.
   - Extracting `buildComparisonRows` into `frontend/lib/formatters/benchmarkComparisons.ts` with direct unit tests in `dashboardMarkets.test.mts`.

2. **Strategy Lab (`/strategy-lab`, `StrategyLabClient.tsx`)**:
   - Interactive configuration form: Strategy (`A`, `B`, `C`), Initialization Mode (`Invest immediately in Bitcoin`, `Wait for first valid signal`), Rebalancing Frequency, Minimum Holding Days, Switching Threshold, Transaction Cost (bps), Drawdown Protection Threshold, Recovery Score, Initial Capital, and Protection Toggles.
   - Actions: Reset to Reference Config, Form Validation, Run Backtest.
   - Connect to `POST /api/backtest/run`, `POST /api/backtest/compare`, `POST /api/backtest/practical`, and `POST /api/backtest/hindsight`.
   - Results interface: Performance KPI grid, continuous numeric time-scale equity curves with BTC/ETH/SOL benchmarks (linear interpolation, Linear/Log toggle), 4 protection-mode comparison table, Strategy A/B/C baseline comparison table, paginated switching history (`pageSize=10`), cash allocation summary.
   - Prominent hindsight disclaimer: `PERFECT HINDSIGHT — NON-INVESTABLE UPPER BOUND` respecting `is_hindsight_upper_bound: true` and `is_investable: false`.

3. **Risk Lab (`/risk-lab`, `RiskLabClient.tsx`)**:
   - Connect to `POST /api/risk/protection` with `include_daily_trace: true`.
   - Visualizations & KPIs: Maximum drawdown, annualized volatility, Sharpe ratio, cash days, protection exit counts, average/median/worst exit drawdown, trigger overshoot analysis.
   - Daily underwater drawdown area chart with continuous numeric time axis.
   - Tables: Trigger overshoot and gap analysis table, paginated diagnostics table, paginated daily drawdown execution trace table (`pageSize=15`).
   - Disclosures: Daily-close observations (not intraday stop-loss), intraday price movement gap risks, transaction costs and switching friction caveats.

4. **Robustness (`/robustness`, `RobustnessClient.tsx`)**:
   - Connect to `POST /api/robustness/analyze`.
   - Fixed walk-forward research periods: Development (`2016-11-09`–`2022-12-31`), Validation (`2023-01-01`–`2024-12-31`), and Test (`2025-01-01`–`2026-11-09`), honestly presenting negative Test-period results.
   - Causal Bitcoin market regimes table and metrics.
   - Asset exposure & return attribution table.
   - Protection event summary table.
   - Predeclared 3×3 parameter sensitivity grid.
   - Methodology, look-ahead bias avoidance, and research limitation disclosures.

5. **Phase 4 Verification & Testing**:
   - Add unit tests for Strategy Lab, Risk Lab, and Robustness formatters/transformations.
   - Extend Playwright E2E harness (`verify_phase4.mjs`) to test interactive configurations, API execution, tables, charts, and clean-port teardown.
   - Run full regression suites: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm run test:e2e`, `backend/tests` (`21/21`), and `tests` (`26/26`).
   - Verify zero modification to backend engines, canonical CSV, or v1.0 `app.py`.
   - Compile `docs/migration/PHASE_04_REPORT.md`.
