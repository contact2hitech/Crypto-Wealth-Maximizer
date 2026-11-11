"""Health endpoint reporting backend readiness and canonical dataset audit status."""

from __future__ import annotations

from fastapi import APIRouter

from backend.schemas.common import ErrorResponse
from backend.schemas.health import HealthResponse
from backend.services.market_service import get_health_status

router = APIRouter(prefix="/api", tags=["Health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    responses={503: {"model": ErrorResponse}},
    summary="Service health and canonical dataset status",
)
def health_check() -> HealthResponse:
    """Verify FastAPI readiness and canonical CSV dataset availability."""
    return get_health_status()

