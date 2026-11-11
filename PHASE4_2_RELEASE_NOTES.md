# Phase 4.2 release notes

## New dashboard
Section 9 is now the Risk Analytics & Protection Validation Lab.

It compares four isolated modes:
- A – Cash filter only
- B – Drawdown protection only
- C – Combined protection
- D – No cash protection

It also includes Bitcoin, Ethereum and Solana buy-and-hold reference benchmarks; equity curves; drawdown curves; event diagnostics; switching history; daily holdings; CSV exports; and walk-forward results.

## Important engine corrections
- Drawdown is checked daily, even when scheduled asset rotation is monthly.
- Cash-filter and drawdown-protection controls are independent.
- Drawdown exits bypass minimum holding and momentum switching thresholds.
- A drawdown-locked portfolio can re-enter only at the scheduled rebalance when the score reaches the configured recovery threshold.
- The high-water mark is reset to NAV on drawdown recovery re-entry, preventing the old peak from immediately re-triggering the same stop.

## Local dataset smoke-test
Using the packaged daily price CSV, $1,480 initial capital, 90-day momentum, monthly rotation, 30-day minimum holding, 10% switch advantage, 10 bps fee and 20% drawdown setting:

| Mode | Final value | Maximum drawdown | Switches | Cash days |
|---|---:|---:|---:|---:|
| Cash filter only | $1,577,437 | -85.63% | 43 | 1,237 |
| Drawdown protection only | $661,871 | -78.43% | 93 | 1,680 |
| Combined protection | $469,759 | -69.94% | 95 | 1,888 |
| No cash protection | $5,100,729 | -91.61% | 28 | 0 |
| Bitcoin buy & hold | $152,439 | -83.40% | 0 | 0 |
| Ethereum buy & hold | $295,317 | -93.96% | 0 | 0 |
| Solana buy & hold | $135,200 | -96.27% | 0 | 0 |

These are historical in-sample results and are not investment recommendations. They show the trade-off clearly: protection reduced the historical worst drawdown, but also substantially reduced final wealth. The combined mode still has a very large drawdown, so it does not meet a conservative risk target.

## Validation
All 20 automated unit tests passed, including:
- independent cash-filter control
- daily drawdown exit independent of monthly rebalance
- threshold sensitivity
- four-mode comparison and benchmark generation
- recovery high-water-mark reset
- walk-forward period coverage
- all previous project tests
