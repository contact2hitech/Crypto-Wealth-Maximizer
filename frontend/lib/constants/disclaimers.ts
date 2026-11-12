export const RESEARCH_DISCLAIMERS = {
  globalBanner:
    "Research software only. Historical backtests are hypothetical, use daily closing prices from the canonical dataset, and are not financial advice or a promise of future performance.",
  pythonSourceOfTruth:
    "All financial calculations execute exclusively in the Python FastAPI calculation engines. The browser UI never independently computes returns, drawdowns, or strategy signals.",
  hindsightWarning:
    "The perfect-hindsight optimizer uses future price knowledge and is strictly an upper-bound experiment, never an investable strategy.",
  dailyStopCaveat:
    "Daily-close drawdown protection evaluates losses after close-to-close moves occur and is not equivalent to an intraday stop-loss guarantee.",
  walkForwardCaveat:
    "Walk-forward Development, Validation, and Test periods reset capital independently and do not represent a single continuous funded account.",
} as const;

