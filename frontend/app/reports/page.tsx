import type { Metadata } from "next";
import { FoundationRouteScaffold } from "@/components/dashboard/FoundationRouteScaffold";
import { RESEARCH_DISCLAIMERS } from "@/lib/constants/disclaimers";

export const metadata: Metadata = {
  title: "Reports | Crypto Wealth Maximizer v2.0",
};

export default function ReportsPage() {
  return (
    <FoundationRouteScaffold
      title="Research Reports & Exports"
      description="Access the consolidated research report, release notes, configuration metadata, and supported CSV backtest exports."
      phaseBadge="Phase 5 Integration Target"
      kpis={[
        { label: "Research Report", sublabel: "FINAL_RESEARCH_REPORT.md via /api/reports/summary" },
        { label: "Release Notes", sublabel: "Release metadata & scope disclosures" },
        { label: "Supported CSV Exports", sublabel: "11 verified datasets mapped in backend" },
        { label: "Reference Config", sublabel: "Strategy, parameters, init mode & range" },
      ]}
      chartTitle="Documentation & Export Readiness"
      chartDescription="Report previews, configuration attribution headers, and CSV/Markdown export actions via /api/reports/*."
      chartEmptyDescription="Full Markdown report rendering, release notes viewer, and CSV/report download controls connect in Phase 5."
      table={{
        title: "Available Report Documents & CSV Exports",
        columns: [
          { key: "id", header: "Export ID" },
          { key: "label", header: "Dataset / Report Name" },
          { key: "workflow", header: "Source Workflow" },
          { key: "format", header: "Format" },
        ],
        emptyDescription:
          "Report document metadata and downloadable CSV export descriptors from GET /api/reports/summary will render here in Phase 5.",
      }}
      warnings={[
        RESEARCH_DISCLAIMERS.hindsightWarning,
        "All generated reports identify the exact strategy, parameters, initialization mode, date range, and methodological limitations.",
      ]}
    />
  );
}

