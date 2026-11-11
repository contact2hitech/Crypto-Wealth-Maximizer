# Phase 4.3 – Initial Capital & Drawdown Audit

## Initial investment modes
1. Invest immediately in Bitcoin: the portfolio starts in Bitcoin on the first evaluation date. Missing momentum history does not cause an automatic cash exit. The first valid strategy signal may subsequently rotate the portfolio.
2. Wait for first valid signal: the portfolio starts in USD cash and remains there until a valid scheduled strategy signal exists.

Both modes are selectable in Section 9 and passed through the four protection-mode comparison and walk-forward analysis.

## Drawdown reporting
- Lifetime maximum drawdown remains measured against the running lifetime portfolio peak.
- The event diagnostics retain the peak used by the active protection cycle and drawdown at the event.
- These measures are intentionally distinct. Resetting a protection-cycle peak after recovery does not erase lifetime drawdown.

## Execution convention
Signals are evaluated at the daily close and changes are applied at that close for the next close-to-close return. This is a simplified close-execution assumption, not a guarantee that a real order could fill at that exact price. A stop can overshoot its threshold because it is only detected after the closing price is observed.

## Validation
- Preserves no-lookahead signal timing.
- Missing indicator history is no longer interpreted as a negative momentum score.
- Added tests for both initialization modes.
- Existing drawdown, cash-filter, walk-forward and strategy tests retained.

## Limitations
This release does not yet add a separate cycle-drawdown time series to every daily holding export or intraday stop execution. The event-level diagnostic drawdown and lifetime equity-curve drawdown should be interpreted separately.
