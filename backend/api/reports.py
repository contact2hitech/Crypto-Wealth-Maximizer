"""Reports summary and Markdown report download endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Response

from backend.schemas.common import ErrorResponse
from backend.schemas.reports import ReportsSummaryResponse
from backend.services.report_service import get_report_document, get_reports_summary

router = APIRouter(prefix="/api/reports", tags=["Reports"])


@router.get(
    "/summary",
    response_model=ReportsSummaryResponse,
    responses={503: {"model": ErrorResponse}},
    summary="Research report, release notes, reference config, and export descriptors",
)
def reports_summary_endpoint() -> ReportsSummaryResponse:
    """Return research report, release notes, dataset coverage, and export descriptors."""
    return get_reports_summary()


@router.get(
    "/download/research-report",
    responses={200: {"content": {"text/markdown": {}}}, 503: {"model": ErrorResponse}},
    summary="Download Final Research Report (Markdown)",
)
def download_research_report() -> Response:
    """Return FINAL_RESEARCH_REPORT.md as a downloadable Markdown attachment."""
    filename, content = get_report_document("research_report")
    return Response(
        content=content,
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/download/release-notes",
    responses={200: {"content": {"text/markdown": {}}}, 503: {"model": ErrorResponse}},
    summary="Download v1.0 Release Notes (Markdown)",
)
def download_release_notes() -> Response:
    """Return RELEASE_NOTES_V1.0.md as a downloadable Markdown attachment."""
    filename, content = get_report_document("release_notes")
    return Response(
        content=content,
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

