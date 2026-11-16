import type { Metadata } from "next";
import { RiskLabClient } from "@/components/risk-lab/RiskLabClient";

export const metadata: Metadata = {
  title: "Risk Lab | Crypto Wealth Maximizer v2.0",
  description:
    "Evaluate downside risk controls, close-to-close drawdown stops, exit overshoot analysis, and complete daily execution traces.",
};

export default function RiskLabPage() {
  return <RiskLabClient />;
}
