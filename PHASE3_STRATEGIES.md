# Phase 3 – Practical no-lookahead strategies

Three daily-close strategies are included:

1. **90-day momentum:** hold the asset with the strongest trailing 90-observation return.
2. **50/200-day trend + momentum:** among assets whose close is above both moving averages, select the strongest trailing 90-observation return. If no asset qualifies, retain the previous holding.
3. **30/90/180-day momentum:** rank by a weighted composite: 20% 30-day, 30% 90-day, 50% 180-day trailing returns.

## No-lookahead execution
Signals calculated using close on date t are shifted and applied to the close-to-close return from t to t+1. The first holding is Bitcoin. No price is forward-filled. If the selected asset lacks a daily return, that day's return is zero; this should be reviewed in the data-quality context. Transaction costs are an optional basis-point deduction per switch.

## Metrics
Final portfolio value, total return, CAGR, maximum drawdown, annualized volatility, zero-risk-free-rate Sharpe ratio, and switch count.

## Limitations
These are simple research rules, not optimized trading advice. Daily close execution is idealized. Fees are simplified as a flat basis-point charge per switch; bid/ask spread, slippage, taxes, liquidity, custody/exchange risk and market impact are not fully modeled. The data source splice for ETH requires further provider reconciliation.
