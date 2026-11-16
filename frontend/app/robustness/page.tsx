import type { Metadata } from "next";
import { RobustnessClient } from "@/components/robustness/RobustnessClient";

export const metadata: Metadata = {
  title: "Robustness | Crypto Wealth Maximizer v2.0",
  description:
    "Fixed-period walk-forward research, causal Bitcoin market regimes, asset exposure attribution, and predeclared 3x3 parameter sensitivity.",
};

export default function RobustnessPage() {
  return <RobustnessClient />;
}
