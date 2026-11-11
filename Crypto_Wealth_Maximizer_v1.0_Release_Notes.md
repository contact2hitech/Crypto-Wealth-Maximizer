# Crypto Wealth Maximizer v1.0 — Release Notes

## Release objective
First consolidated release focused on completing the research application, documenting its methodology and preserving existing backtesting functionality.

## Included
- Historical BTC, ETH and SOL price analysis.
- Normalized and common-start asset comparisons.
- Buy-and-hold benchmarks and perfect-hindsight upper-bound illustration (clearly labelled).
- Three practical signal strategies.
- Constrained backtesting with cash allocation and drawdown protection.
- Four protection-mode comparisons.
- Both initial investment modes.
- Walk-forward evaluation.
- Daily drawdown execution trace.
- Market regime analysis, asset exposure summary, protection diagnostics and parameter sensitivity.
- CSV exports.
- Automated unit tests.
- Final research report and installation documentation.

## Scope deliberately deferred
Live exchange connectivity, automated trading, intraday execution simulation, OHLC-based stops, machine-learning forecasts, and extensive parameter-search automation are not part of v1.0.

## Verification
The supplied Phase 4.4.1 baseline reported 26/26 automated tests passing. The v1.0 package should be tested again in the target local environment using the commands in README.md.
