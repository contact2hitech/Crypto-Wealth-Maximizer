import type { Metadata } from "next";
import { FoundationRouteScaffold } from "@/components/dashboard/FoundationRouteScaffold";
import { RESEARCH_DISCLAIMERS } from "@/lib/constants/disclaimers";

export const metadata: Metadata = {
  title: "Risk Lab | Crypto Wealth Maximizer v2.0",
};

export default function RiskLabPage() {
  return (
    <FoundationRouteScaffold
      title="Risk Analytics & Protection Lab"
      description="Evaluate maximum drawdown, annualized volatility, Sharpe ratio, protection exit overshoot, and the daily drawdown execution trace."
      phaseBadge="Phase 4 Integration Target"
      kpis={[
        { label: "Protection Exits", sublabel: "Drawdown exit count via POST /api/risk/protection" },
        { label: "Average Exit Drawdown", sublabel: "Mean drawdown at protection exit" },
        { label: "Median Exit Drawdown", sublabel: "Median drawdown at protection exit" },
        { label: "Worst Recorded Exit", sublabel: "Largest single exit breach & overshoot" },
      ]}
      chartTitle="Underwater Drawdown & Protection Trigger Trace"
      chartDescription="Daily underwater drawdown profile and close-to-close trigger breach diagnostics from /api/risk/protection."
      chartEmptyDescription="Daily underwater drawdown charts and protection exit event diagnostics will render here in Phase 4."
      table={{
        title: "Daily Drawdown Execution Trace",
        columns: [
          { key: "date", header: "Date", numeric: true },
          { key: "holding_before", header: "Holding Before" },
          { key: "return_pct", header: "Daily Return (%)", numeric: true },
          { key: "drawdown_pct", header: "Drawdown (%)", numeric: true },
          { key: "decision", header: "Decision" },
        ],
        emptyDescription:
          "Daily close-by-close drawdown trace rows from POST /api/risk/protection will render here in Phase 4.",
      }}
      warnings={[RESEARCH_DISCLAIMERS.dailyStopCaveat]}
    />
  );
}

