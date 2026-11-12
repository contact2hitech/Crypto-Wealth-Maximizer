import type { Metadata } from "next";
import { MarketsClient } from "@/components/markets/MarketsClient";

export const metadata: Metadata = {
  title: "Markets | Crypto Wealth Maximizer v2.0",
};

export default function MarketsPage() {
  return <MarketsClient />;
}
