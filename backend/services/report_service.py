"""Research reports, release notes, and export metadata service."""

from __future__ import annotations

from typing import Literal

from backend.core.config import get_settings
from backend.core.data_loader import get_dataset_snapshot
from backend.core.exceptions import DataUnavailableError
from backend.schemas.reports import (
    CsvExportDescriptor,
    ReportDocumentItem,
    ReportsSummaryResponse,
)
from backend.services.common import STANDARD_LIMITATIONS

DOCUMENT_CATALOG: dict[Literal["research_report", "release_notes"], dict[str, str]] = {
    "research_report": {
        "title": "Crypto Wealth Maximizer v1.0 — Final Research Report",
        "source_filename": "FINAL_RESEARCH_REPORT.md",
        "download_filename": "Crypto_Wealth_Maximizer_Final_Research_Report.md",
        "download_path": "/api/reports/download/research-report",
    },
    "release_notes": {
        "title": "Crypto Wealth Maximizer v1.0 — Release Notes",
        "source_filename": "RELEASE_NOTES_V1.0.md",
        "download_filename": "Crypto_Wealth_Maximizer_v1.0_Release_Notes.md",
        "download_path": "/api/reports/download/release-notes",
    },
}

CSV_EXPORT_DESCRIPTORS: list[CsvExportDescriptor] = [
    CsvExportDescriptor(
        id="cleaned_daily_prices",
        label="Cleaned Daily Historical Prices (BTC, ETH, SOL)",
        source_workflow="markets",
    ),
    CsvExportDescriptor(
        id="practical_strategy_switches",
        label="Practical Strategy Switches",
        source_workflow="practical_strategies",
    ),
    CsvExportDescriptor(
        id="protection_mode_switches",
        label="Constrained / Protection Mode Switching History",
        source_workflow="constrained_backtest",
    ),
    CsvExportDescriptor(
        id="daily_holding_history",
        label="Daily Holding & USD Cash Allocation History",
        source_workflow="constrained_backtest",
    ),
    CsvExportDescriptor(
        id="risk_event_diagnostics",
        label="Risk Event Diagnostics",
        source_workflow="risk_protection_analysis",
    ),
    CsvExportDescriptor(
        id="daily_drawdown_execution_trace",
        label="Daily Drawdown Execution Trace",
        source_workflow="risk_protection_analysis",
    ),
    CsvExportDescriptor(
        id="walk_forward_results",
        label="Walk-Forward Validation Results",
        source_workflow="robustness_analysis",
    ),
    CsvExportDescriptor(
        id="market_regime_analysis",
        label="Causal BTC Market Regime Analysis",
        source_workflow="robustness_analysis",
    ),
    CsvExportDescriptor(
        id="asset_attribution",
        label="Asset Exposure & Return Attribution",
        source_workflow="robustness_analysis",
    ),
    CsvExportDescriptor(
        id="protection_exit_analysis",
        label="Drawdown Protection Exit Overshoot Analysis",
        source_workflow="robustness_analysis",
    ),
    CsvExportDescriptor(
        id="parameter_sensitivity",
        label="Predeclared Parameter Sensitivity Grid",
        source_workflow="robustness_analysis",
    ),
]


def _read_markdown_document(filename: str) -> str:
    path = get_settings().repo_root / filename
    if not path.exists() or not path.is_file():
        raise DataUnavailableError(
            "Requested research document was not found.",
            details={"filename": filename},
        )
    return path.read_text(encoding="utf-8")


def get_report_document(
    doc_id: Literal["research_report", "release_notes"],
) -> tuple[str, str]:
    """Return (download_filename, markdown_text) for a documented project report."""
    spec = DOCUMENT_CATALOG[doc_id]
    content = _read_markdown_document(spec["source_filename"])
    return spec["download_filename"], content


def get_reports_summary() -> ReportsSummaryResponse:
    """Return available research reports, release notes, reference config, and export descriptors."""
    snapshot = get_dataset_snapshot()
    meta = snapshot.metadata
    documents: list[ReportDocumentItem] = []
    for doc_id, spec in DOCUMENT_CATALOG.items():
        documents.append(
            ReportDocumentItem(
                id=doc_id,
                title=spec["title"],
                source_filename=spec["source_filename"],
                download_filename=spec["download_filename"],
                download_path=spec["download_path"],
                content_markdown=_read_markdown_document(spec["source_filename"]),
            )
        )

    return ReportsSummaryResponse(
        project_name="Crypto Wealth Maximizer",
        source_version="1.0",
        target_version="2.0",
        dataset_coverage={
            "path_relative": meta.path_relative,
            "start_date": meta.start_date,
            "end_date": meta.end_date,
            "row_count": meta.row_count,
            "assets": list(meta.assets_available),
        },
        reference_configuration={
            "strategy": "A: 90-day momentum",
            "initial_capital_usd": 1480.0,
            "initialization_mode": "Invest immediately in Bitcoin",
            "rebalance_frequency": "Monthly",
            "minimum_holding_days": 30,
            "switching_threshold_pct": 10.0,
            "fee_bps_per_switch": 10.0,
            "drawdown_protection_pct": 20.0,
            "cash_reentry_score_pct": 0.0,
            "protection_mode": "Combined cash filter and drawdown protection",
        },
        documents=documents,
        supported_csv_exports=list(CSV_EXPORT_DESCRIPTORS),
        limitations=list(STANDARD_LIMITATIONS),
    )

