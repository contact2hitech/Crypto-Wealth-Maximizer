"""Schemas for GET /api/reports/summary endpoint."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel


class ReportDocumentItem(BaseModel):
    """Available Markdown research/release document metadata and content."""

    id: Literal["research_report", "release_notes"]
    title: str
    source_filename: str
    download_filename: str
    download_path: str
    content_markdown: str


class CsvExportDescriptor(BaseModel):
    """Describes supported CSV export datasets across v2.0 workflows."""

    id: str
    label: str
    source_workflow: str


class ReportsSummaryResponse(BaseModel):
    """Response payload for GET /api/reports/summary."""

    project_name: str
    source_version: str
    target_version: str
    dataset_coverage: dict[str, Any]
    reference_configuration: dict[str, Any]
    documents: list[ReportDocumentItem]
    supported_csv_exports: list[CsvExportDescriptor]
    limitations: list[str]

