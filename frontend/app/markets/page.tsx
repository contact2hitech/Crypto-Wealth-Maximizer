import type { Metadata } from "next";
import { FoundationRouteScaffold } from "@/components/dashboard/FoundationRouteScaffold";

export const metadata: Metadata = {
  title: "Markets | Crypto Wealth Maximizer v2.0",
};

export default function MarketsPage() {
  return (
    <FoundationRouteScaffold
      title="Historical Markets & Data Quality"
      description="Historical daily USD closes for Bitcoin, Ethereum, and Solana, normalized and common-start comparisons, crossovers, and dataset quality audit."
      phaseBadge="Phase 3 Integration Target"
      kpis={[
        { label: "Bitcoin Latest Close", sublabel: "Populated from GET /api/markets/summary in Phase 3" },
        { label: "Ethereum Latest Close", sublabel: "Populated from GET /api/markets/summary in Phase 3" },
        { label: "Solana Latest Close", sublabel: "Available from 2020-04-10 in Phase 3" },
        { label: "Common-Start Date", sublabel: "Three-asset overlap start via crypto_engine" },
      ]}
      chartTitle="Historical Asset Prices & Normalized Performance"
      chartDescription="Daily closing prices, individual 100-indexed curves, and common-start three-way comparisons via /api/markets/prices."
      chartEmptyDescription="Interactive BTC, ETH, and SOL price and normalized comparison charts will render here in Phase 3."
      table={{
        title: "Per-Asset Data Quality & Availability",
        columns: [
          { key: "asset", header: "Asset" },
          { key: "first_date", header: "First Available", numeric: true },
          { key: "last_date", header: "Last Available", numeric: true },
          { key: "valid_obs", header: "Valid Days", numeric: true },
          { key: "missing_obs", header: "Missing Days", numeric: true },
        ],
        emptyDescription:
          "Asset availability and data quality audit metrics from GET /api/markets/summary will render here in Phase 3.",
      }}
      warnings={[
        "Solana did not exist before its first observed date (2020-04-10). Pre-launch observations remain null and are never fabricated or forward-filled.",
        "Ethereum history prior to 2017-11-09 in the bundled CSV reflects a reconciled series noted as provisional in DATA_SOURCES.md.",
      ]}
    />
  );
}

