import type { Metadata } from "next";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export const metadata: Metadata = {
  title: "Dashboard | Crypto Wealth Maximizer v2.0",
};

export default function DashboardPage() {
  return <DashboardClient />;
}
