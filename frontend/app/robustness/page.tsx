import type { Metadata } from "next";
import { FoundationRouteScaffold } from "@/components/dashboard/FoundationRouteScaffold";
import { RESEARCH_DISCLAIMERS } from "@/lib/constants/disclaimers";

export const metadata: Metadata = {
  title: "Robustness | Crypto Wealth Maximizer v2.0",
};

export default function RobustnessPage() {
  return (
    <FoundationRouteScaffold
      title="Robustness & Walk-Forward Analysis"
      description="Independent Development, Validation, and Test evaluations, predeclared parameter sensitivity, causal market regimes, and asset attribution."
      phaseBadge="Phase 4 Integration Target"
      kpis={[
        { label: "Development CAGR", sublabel: "2016-11-09 to 2022-12-31 (fresh capital)" },
        { label: "Validation CAGR", sublabel: "2023-01-01 to 2024-12-31 (fresh capital)" },
        { label: "Held-Out Test CAGR", sublabel: "2025-01-01 to 2026-11-09 (fresh capital)" },
        { label: "Sensitivity Grid", sublabel: "3 strategies × 3 drawdown triggers" },
      ]}
      chartTitle="Walk-Forward, Regime & Parameter Sensitivity"
      chartDescription="Fixed-period walk-forward outcomes, causal Bitcoin regime attribution, and descriptive sensitivity analysis via /api/robustness/analyze."
      chartEmptyDescription="Walk-forward results, causal market regime breakdowns, asset exposure attribution, and sensitivity tables connect in Phase 4."
      table={{
        title: "Walk-Forward Independent Periods",
        columns: [
          { key: "period", header: "Period" },
          { key: "date_range", header: "Window", numeric: true },
          { key: "final_value", header: "Final Value (USD)", numeric: true },
          { key: "cagr", header: "CAGR (%)", numeric: true },
          { key: "sharpe", header: "Sharpe (rf=0)", numeric: true },
        ],
        emptyDescription:
          "Development, Validation, and Test period rows from POST /api/robustness/analyze will render here in Phase 4.",
      }}
      warnings={[
        RESEARCH_DISCLAIMERS.walkForwardCaveat,
        "Negative Test-period returns and drawdowns are always displayed prominently; historical development gains do not prove future profitability.",
      ]}
    />
  );
}

