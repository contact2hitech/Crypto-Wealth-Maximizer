import type { Metadata } from "next";
import { FoundationRouteScaffold } from "@/components/dashboard/FoundationRouteScaffold";
import { RESEARCH_DISCLAIMERS } from "@/lib/constants/disclaimers";

export const metadata: Metadata = {
  title: "Dashboard | Crypto Wealth Maximizer v2.0",
};

export default function DashboardPage() {
  return (
    <FoundationRouteScaffold
      title="Research Dashboard"
      description="Portfolio performance overview, equity curve, buy-and-hold benchmarks, drawdown profile, and active strategy configuration."
      phaseBadge="Phase 3 Integration Target"
      kpis={[
        { label: "Final Portfolio Value", sublabel: "Populated from POST /api/backtest/run in Phase 3" },
        { label: "Total Return / CAGR", sublabel: "Populated from Python optimization_engine in Phase 3" },
        { label: "Maximum Drawdown", sublabel: "Lifetime underwater peak-to-trough in Phase 3" },
        { label: "Sharpe Ratio (rf=0)", sublabel: "Annualized risk-adjusted metric in Phase 3" },
      ]}
      chartTitle="Portfolio Equity & Benchmark Comparison"
      chartDescription="Historical daily equity curve and underwater drawdown chart backed by /api/backtest/run."
      chartEmptyDescription="Dashboard equity curves, buy-and-hold comparisons, and drawdown charts will be wired to the FastAPI backend in Phase 3."
      table={{
        title: "Strategy & Benchmark Summary",
        columns: [
          { key: "strategy", header: "Strategy / Benchmark" },
          { key: "final_value", header: "Final Value (USD)", numeric: true },
          { key: "cagr", header: "CAGR (%)", numeric: true },
          { key: "max_dd", header: "Max Drawdown (%)", numeric: true },
          { key: "sharpe", header: "Sharpe (rf=0)", numeric: true },
        ],
        emptyDescription:
          "Summary rows from POST /api/backtest/run and buy-and-hold benchmarks will render here in Phase 3.",
      }}
      warnings={[
        RESEARCH_DISCLAIMERS.dailyStopCaveat,
        RESEARCH_DISCLAIMERS.walkForwardCaveat,
      ]}
    />
  );
}

