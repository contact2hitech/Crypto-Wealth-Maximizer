# Phase 4 – Strategy Optimization Lab

## New controls
- Rebalancing: daily, weekly, every 15 days, monthly.
- Minimum holding period: 0, 7, 14, 30, 60 calendar days.
- Switching threshold: require the new asset's score to exceed the current asset's score by the selected percentage-point margin.
- Transaction cost: flat basis-point charge each time the holding changes.

## Execution timing
At close t, compute signals and decide the target holding. That target is applied to the return from close t to close t+1. Fees are deducted on the first subsequent daily return. This prevents same-close signal execution from receiving the already-observed return.

## Walk-forward periods
- Development: 2016-11-09 to 2022-12-31
- Validation: 2023-01-01 to 2024-12-31
- Test: 2025-01-01 to 2026-11-09

The same fixed parameter set is evaluated in each period. This first implementation does not fit/tune parameters on validation/test periods. Earlier observations are retained as indicator warm-up, and portfolio values are rebased at each period start.

## Important caveats
- These are simplified long-only research strategies, not investment advice.
- Daily closes are used; intraday execution, spreads, slippage, taxes, market impact, liquidity and custody risk are not modeled.
- Flat fee in basis points is a simplified one-time deduction per switch.
- Missing returns for the selected asset are treated as zero for that interval; investigate gaps before relying on results.
- The ETH history is a source splice; source-consistency validation remains necessary.
