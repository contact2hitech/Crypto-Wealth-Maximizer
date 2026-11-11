"""Robustness endpoint covering walk-forward, regimes, attribution, and sensitivity."""

from __future__ import annotations

from fastapi import APIRouter

from backend.schemas.common import ErrorResponse
from backend.schemas.robustness import RobustnessAnalyzeRequest, RobustnessAnalyzeResponse
from backend.services.robustness_service import analyze_robustness

router = APIRouter(prefix="/api/robustness", tags=["Robustness"])


@router.post(
    "/analyze",
    response_model=RobustnessAnalyzeResponse,
    responses={422: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
    summary="Walk-forward validation, BTC market regimes, asset attribution, and sensitivity grid",
)
def robustness_analyze_endpoint(payload: RobustnessAnalyzeRequest) -> RobustnessAnalyzeResponse:
    """Run independent fixed-period walk-forward (full dataset) plus robustness diagnostics."""
    return analyze_robustness(payload)

