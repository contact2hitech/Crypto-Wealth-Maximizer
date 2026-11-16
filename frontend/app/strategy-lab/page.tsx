import type { Metadata } from "next";
import { StrategyLabClient } from "@/components/strategy-lab/StrategyLabClient";

export const metadata: Metadata = {
  title: "Strategy Lab | Crypto Wealth Maximizer v2.0",
  description:
    "Interactive strategy experimentation, 4 protection mode comparisons, practical no-lookahead baselines, and theoretical hindsight upper bounds.",
};

export default function StrategyLabPage() {
  return <StrategyLabClient />;
}
