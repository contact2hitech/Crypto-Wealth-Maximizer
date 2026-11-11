# Phase 4.4 — Strategy Robustness Investigation

## What is new
- Causal Bitcoin market-regime classification using 200-day SMA and 90-day return.
- Portfolio performance summarized by Bull, Bear, Sideways/Mixed, and insufficient-history regimes.
- Asset exposure and daily portfolio-return attribution by the holding selected for each day.
- Protection event summaries and drawdown-exit overshoot analysis using the configured trigger.
- Predeclared sensitivity grid: three momentum definitions × 10%, 20%, and 30% drawdown triggers.
- CSV downloads for every analysis table.

## Important interpretation notes
- Regime labels use only historical data available through each date; the first indicator warm-up observations are marked Insufficient history.
- Regime return is the compounded portfolio return over days assigned to that regime; regime days are non-contiguous.
- Asset attribution groups portfolio daily returns by the holding recorded for that date. Switching fees are included in portfolio returns and may be charged on a transition date.
- Sensitivity is descriptive, not an automatic optimizer. Do not select a strategy solely by its highest historical final value.
- Backtests use daily close assumptions and do not fully model intraday execution, spreads, slippage, taxes, liquidity, or exchange outages.
- Existing walk-forward periods remain independent tests with fresh initial capital; they are not a continuous portfolio.

## Reconciliation of Phase 4.3 exports
For Combined Protection, both switching-history exports exactly match daily holding transitions and risk-event rows:
- Invest immediately in Bitcoin: 95 / 95 / 95.
- Wait for first valid signal: 94 / 94 / 94.
The earlier 42-row exports belonged to Cash Filter Only (Experiment A), not Combined Protection (Experiment C).

## Validation
- Existing Phase 4.3 tests: 21 passed.
- New robustness-engine tests: 3 added.
- Total automated tests: 24.

## Phase 4.4.1 – Drawdown execution audit and daily trace

This refinement adds a daily drawdown execution trace to the protection experiment inspector. The trace records, for every evaluation date:
- holding during the close-to-close interval and holding before/after the decision;
- portfolio value before the interval and before the protection decision;
- prior and current high-water marks, including whether a new high was set;
- close-to-close portfolio return and drawdown before the decision;
- configured trigger, breach flag, rebalance schedule, decision reason;
- the simulator's same-daily-close execution assumption and fee rate.

### Audit finding on the bundled historical dataset

For the reference configuration (Strategy A, monthly rebalance, 30-day minimum hold, 10% switching threshold, 10 bps fee, 20% drawdown protection, 0% recovery score, immediate Bitcoin initialization), the worst drawdown-protection exit occurred on 2020-09-05:
- drawdown at decision: -40.2622%;
- prior high-water mark: $106,430.23;
- portfolio value before decision: $63,579.07;
- holding: Solana -> USD Cash;
- 2020-09-05 close-to-close portfolio return: -26.7325%;
- on 2020-09-03, drawdown was -18.8906%, still above the -20% trigger, and on 2020-09-04 it recovered slightly to -18.4662%.

This supports a daily-observation gap explanation for the overshoot. The backtest detects a breach only after the daily close-to-close return has already been applied. It then assumes execution at that same close. This is a modelling assumption, not a verified executable fill. No intraday OHLC data is used in this audit.

The trace is available in the protection experiment inspector as `daily_drawdown_execution_trace.csv`. It is a diagnostic export and does not change the strategy rules or historical performance calculations.

Automated test suite after this refinement: 26 tests passed.
