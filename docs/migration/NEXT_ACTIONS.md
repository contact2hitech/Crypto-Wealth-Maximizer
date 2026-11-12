# Next Actions — Phase 3 Review Gate & Phase 4 Preparation

## Authoritative Gate Status
- **Status**: `AWAITING_EXTERNAL_REVIEW`
- **Current Phase Completed**: Phase 3 (Dashboard and Markets Integration)
- **Next Phase**: Phase 4 (Strategy Lab, Risk Lab and Robustness)
- **Instruction**: Do **not** begin Phase 4 implementation until Phase 3 has been reviewed and Phase 4 is explicitly approved in this file (or explicit user approval is received).

---

## Proposed Phase 4 Scope (Subject to External Approval)

When approved to proceed to Phase 4, execute the following tasks on branch `v2.0-nextjs-migration`:

1. **Strategy Lab (`/strategy-lab`)**:
   - Interactive form controls for Strategy (`A`, `B`, `C`), Protection Mode / Toggles, Initialization Mode (`Invest immediately in Bitcoin`, `Wait for first valid signal`), Rebalancing Frequency, Minimum Holding Days, Switching Threshold, Transaction Cost (bps), Drawdown Protection Threshold, and Recovery Score.
   - Connect to `POST /api/backtest/run`, `POST /api/backtest/compare` (4 protection modes + 3 benchmarks), `POST /api/backtest/practical` (no-lookahead baseline Strategies A/B/C), and `POST /api/backtest/hindsight` (explicitly marked `is_hindsight_upper_bound: true` / non-investable).
   - Display configuration summary, equity & benchmark charts, paginated switching history, cash allocation summary, and Phase 4/5 export hooks.

2. **Risk Lab (`/risk-lab`)**:
   - Connect to `POST /api/risk/protection` (including `include_daily_trace: true`).
   - Display maximum drawdown, volatility, Sharpe ratio, daily underwater drawdown trace, protection exit counts, average/median/worst exit drawdown, trigger overshoot analysis, and explicit daily-close vs intraday stop-loss disclosures.

3. **Robustness (`/robustness`)**:
   - Connect to `POST /api/robustness/analyze`.
   - Display fixed-period Development, Validation, and Test walk-forward results (highlighting negative Test-period CAGR/Sharpe honestly), causal Bitcoin market regimes, asset exposure & return attribution, protection exit summary, and predeclared 3×3 parameter sensitivity grid.

4. **Phase 4 Verification Gate**:
   - Reconcile Strategy Lab, Risk Lab, and Robustness figures 100% with Python engines / v1.0 outputs.
   - Pass all frontend unit/static/build checks, Playwright end-to-end verification, `backend/tests` (`21/21`), and `tests` (`26/26`).
