# Phase 4.2 – Risk Engine Validation Lab

## What changed
- Cash-filter and drawdown-protection rules are independently switchable.
- Daily drawdown checks run at every daily close, even when portfolio rotation is monthly or weekly.
- Drawdown exits bypass the minimum holding-period and switching-threshold restrictions.
- Re-entry after a drawdown lock is considered on the next scheduled rebalance when the best strategy score reaches the configured recovery threshold.
- The high-water mark is reset to the portfolio value at drawdown recovery re-entry. This prevents the old drawdown peak from immediately retriggering the same stop on the next session.
- Four protection experiments are compared side-by-side:
  A. Cash filter only
  B. Drawdown protection only
  C. Combined protection
  D. Neither protection
- Bitcoin, Ethereum and Solana buy-and-hold benchmarks are included.
- Equity curves, drawdown curves, event diagnostics, trade history and daily holdings are downloadable.

## Signal and execution convention
The simulator marks portfolio value using the return earned since the previous close, then evaluates the new signal at the current close. A resulting position change is applied at that close, with its transaction fee deducted immediately. That new holding earns the next close-to-close return. This is a close-based simplified execution convention; it does not model next-day opening gaps or intraday execution.

Drawdown protection is evaluated daily. The regular asset-rotation decision and drawdown recovery re-entry remain subject to the selected rebalance schedule. A drawdown exit is not delayed by that schedule.

## Walk-forward
The development, validation and test periods are evaluated separately, each with a fresh initial capital amount. Earlier observations are available as indicator warm-up, but each period's portfolio begins in Bitcoin with a new high-water mark. These are independent period tests, not one continuously funded account.

## Interpretation cautions
- USD cash is assumed to earn 0%; no interest or stablecoin yield is modeled.
- A drawdown stop cannot prevent a gap loss beyond its trigger.
- Maximum drawdown can exceed the selected trigger because the price move that crosses the threshold has already occurred by the close when it is detected.
- Missing daily returns for the held asset are treated as zero; missing-data intervals should be audited.
- Fees are simplified flat basis-point deductions per switch. Spread, slippage, tax, market impact, custody and FX costs are excluded.
- Backtests are historical research, not investment advice.
