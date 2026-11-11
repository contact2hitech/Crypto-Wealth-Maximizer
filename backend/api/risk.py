"""Risk Lab endpoint exposing protection diagnostics and daily drawdown execution trace."""

from __future__ import annotations

from fastapi import APIRouter

from backend.schemas.common import ErrorResponse
from backend.schemas.risk import RiskProtectionRequest, RiskProtectionResponse
from backend.services.risk_service import analyze_risk_protection

router = APIRouter(prefix="/api/risk", tags=["Risk Lab"])


@router.post(
    "/protection",
    response_model=RiskProtectionResponse,
    responses={422: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
    summary="Protection exit diagnostics, overshoot analysis, and daily drawdown trace",
)
def risk_protection_endpoint(payload: RiskProtectionRequest) -> RiskProtectionResponse:
    """Compute risk metrics, exit overshoot statistics, and daily drawdown trace."""
    return analyze_risk_protection(payload)

