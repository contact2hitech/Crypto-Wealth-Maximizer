export interface NavRouteItem {
  href: "/dashboard" | "/markets" | "/strategy-lab" | "/risk-lab" | "/robustness" | "/reports";
  label: string;
  shortDescription: string;
  phaseNote: string;
}

export const NAV_ROUTES: NavRouteItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    shortDescription: "Portfolio KPIs, equity & drawdown overview, allocation, and key warnings",
    phaseNote: "Live metrics & equity charts connect in Phase 3",
  },
  {
    href: "/markets",
    label: "Markets",
    shortDescription: "Historical BTC/ETH/SOL prices, normalized & common-start indices, data quality",
    phaseNote: "Historical price charts & quality audit connect in Phase 3",
  },
  {
    href: "/strategy-lab",
    label: "Strategy Lab",
    shortDescription: "Practical strategies A/B/C, protection modes, initialization, and switch history",
    phaseNote: "Interactive parameter controls & backtests connect in Phase 4",
  },
  {
    href: "/risk-lab",
    label: "Risk Lab",
    shortDescription: "Maximum drawdown, exit diagnostics, overshoot analysis, and daily close trace",
    phaseNote: "Risk diagnostics & daily drawdown trace connect in Phase 4",
  },
  {
    href: "/robustness",
    label: "Robustness",
    shortDescription: "Walk-forward splits, parameter sensitivity, market regimes, and attribution",
    phaseNote: "Walk-forward, regimes & sensitivity connect in Phase 4",
  },
  {
    href: "/reports",
    label: "Reports",
    shortDescription: "Research report, release notes, configuration metadata, and CSV exports",
    phaseNote: "Document previews & CSV downloads connect in Phase 5",
  },
];

