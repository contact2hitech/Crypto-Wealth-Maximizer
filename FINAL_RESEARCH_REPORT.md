# Crypto Wealth Maximizer v1.0 — Final Research Report

## Purpose and scope

Crypto Wealth Maximizer is a historical research and backtesting application for Bitcoin (BTC), Ethereum (ETH), Solana (SOL), and USD cash. It compares practical, signal-based portfolio strategies and risk controls using daily historical prices.

This project is an educational/research tool. It is not financial advice, does not forecast future prices, and does not place trades.

## Data and methodology

- Historical dataset: daily closing prices for BTC, ETH and SOL.
- SOL has a later first available date than BTC and ETH; unavailable prices are not fabricated.
- Practical strategy signals are based on information available at a daily close and are applied to subsequent daily returns.
- The constrained backtest supports cash allocation, rebalancing schedules, minimum holding periods, switching thresholds, transaction costs, drawdown protection, recovery conditions, and two initialization modes.
- Walk-forward periods are independent evaluations with fresh starting capital. They are not one continuous portfolio.
- Daily-close drawdown protection is not an intraday stop-loss and cannot guarantee a maximum loss equal to its configured threshold.
- Historical backtests are sensitive to data, assumptions, market regime, fees, slippage, and execution timing.

## Reference configuration used in the project review

| Setting | Reference value |
|---|---:|
| Strategy | A — 90-day momentum |
| Initial capital | USD 1,480 |
| Initialization | Invest immediately in Bitcoin |
| Rebalancing | Monthly |
| Minimum holding period | 30 days |
| Switching threshold | 10% |
| Transaction cost | 10 bps per switch |
| Drawdown protection | 20% |
| Recovery score | 0% |
| Protection mode | Combined cash filter and drawdown protection |

## Reference historical result

The project review dashboard reported the following for the reference configuration:

| Metric | Historical result |
|---|---:|
| Final portfolio value | USD 585,970.46 |
| Total return | 39,492.60% |
| CAGR | 81.89% |
| Maximum drawdown | -69.94% |
| Annualized volatility | 68.43% |
| Sharpe ratio (risk-free rate 0) | 1.21 |
| Switches | 95 |
| Cash days | 1,830 |

These are historical simulated results from the reviewed dataset and configuration. They must not be interpreted as expected returns.

## Initialization comparison

The two modes are retained:

1. **Invest immediately in Bitcoin** — begins with Bitcoin exposure.
2. **Wait for first valid signal** — begins in cash until the first valid scheduled signal.

In the reviewed Combined Protection comparison, immediate Bitcoin initialization produced a higher historical final value than waiting for a signal. The difference was concentrated in the initial period; subsequent validation and test results were nearly identical.

## Walk-forward findings

The Wait-for-signal report showed:

| Period | Final value | CAGR | Maximum drawdown | Sharpe |
|---|---:|---:|---:|---:|
| Development | USD 223,912.42 | 126.44% | -69.94% | 1.45 |
| Validation | USD 4,900.90 | 82.05% | -41.31% | 1.27 |
| Test | USD 938.60 | -21.74% | -52.02% | -0.46 |

The negative Test-period CAGR and Sharpe ratio are material limitations. They indicate that strong earlier historical results did not generalize to the held-out test period in this evaluation.

Each period starts with fresh capital. These figures are not a continuous account curve.

## Protection findings

The reviewed Wait-for-signal Combined Protection diagnostics contained 39 drawdown exits. Average exit drawdown was approximately -24.07%, median approximately -22.74%, and the worst recorded exit was approximately -40.26%.

The configured 20% level is a daily-close trigger, not a guaranteed maximum drawdown. A sharp move between daily observations can cause the observed close to breach the trigger by a large amount before the system can act. The current simulation assumes same-close detection/execution and does not model intraday fills or next-day execution.

## Sensitivity findings

The predeclared sensitivity grid compared three momentum definitions and 10%, 20%, and 30% drawdown triggers. Strategy A (90-day momentum) produced the highest historical final values in the reviewed Wait-for-signal grid. Higher drawdown thresholds generally allowed greater exposure and higher returns in Strategy A, but also increased maximum drawdown.

The grid is descriptive, not an automatic parameter optimizer. Selecting a configuration solely because it maximizes historical final value risks overfitting.

## Important limitations

- The dataset is historical and limited to the assets and dates included.
- Daily close data does not represent intraday trading opportunities or fills.
- Transaction-cost assumptions do not fully capture spreads, market impact, liquidity, exchange fees, taxes, or slippage.
- A backtest can be affected by survivorship, data quality, parameter selection, and regime dependence.
- The regime analysis classifies historical days; regime-conditioned compounded returns are not independent investable periods.
- Asset exposure attribution describes portfolio returns during holding days and should not be mistaken for a complete causal decomposition of profit by asset.
- The project does not connect to an exchange or execute real orders.

## Conclusion

Crypto Wealth Maximizer v1.0 provides a reproducible environment for historical comparison, strategy backtesting, protection analysis, walk-forward evaluation, and CSV export. The reference strategy is retained for demonstration and repeatable research, not as a recommendation to invest.

The negative test-period result and large drawdowns should remain prominent in any presentation or publication of this project.
