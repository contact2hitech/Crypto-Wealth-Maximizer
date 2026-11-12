import type { Metadata } from "next";
import { FoundationRouteScaffold } from "@/components/dashboard/FoundationRouteScaffold";
import { RESEARCH_DISCLAIMERS } from "@/lib/constants/disclaimers";

export const metadata: Metadata = {
  title: "Strategy Lab | Crypto Wealth Maximizer v2.0",
};

export default function StrategyLabPage() {
  return (
    <FoundationRouteScaffold
      title="Strategy Lab"
      description="Configure Strategies A, B, and C, protection modes, portfolio initialization, rebalancing frequency, holding periods, thresholds, and transaction fees."
      phaseBadge="Phase 4 Integration Target"
      kpis={[
        { label: "Configured Strategy", sublabel: "Strategies A, B, C via POST /api/backtest/run" },
        { label: "Protection Mode", sublabel: "Cash filter, drawdown stop, combined, or none" },
        { label: "Position Switches", sublabel: "Executed switch count from optimization_engine" },
        { label: "USD Cash Days", sublabel: "Days allocated to 0%-yield USD cash" },
      ]}
      chartTitle="Constrained Strategy Equity & Benchmark Curves"
      chartDescription="Four protection modes, practical strategy baselines, and explicitly labelled perfect-hindsight upper-bound comparisons."
      chartEmptyDescription="Interactive strategy configuration forms, equity curves, and switching/cash allocation histories connect in Phase 4."
      table={{
        title: "Switching & Cash Allocation History",
        columns: [
          { key: "signal_date", header: "Signal Date", numeric: true },
          { key: "from_asset", header: "From" },
          { key: "to_asset", header: "To" },
          { key: "reason", header: "Decision Reason" },
          { key: "value_after_fee", header: "Value After Fee (USD)", numeric: true },
        ],
        emptyDescription:
          "Trade switches and cash allocation transitions returned by POST /api/backtest/run and /api/backtest/compare will render here in Phase 4.",
      }}
      warnings={[
        RESEARCH_DISCLAIMERS.hindsightWarning,
        "Flat basis-point switch fees simplify market frictions and omit spreads, slippage, taxes, and liquidity impact.",
      ]}
    />
  );
}

