"""Market price, normalized index, crossover, buy-and-hold, and data quality endpoints."""

from __future__ import annotations

import datetime
from typing import Optional

from fastapi import APIRouter, Query

from backend.schemas.common import ErrorResponse
from backend.schemas.markets import MarketPricesResponse, MarketSummaryResponse
from backend.services.market_service import get_market_prices, get_market_summary

router = APIRouter(prefix="/api/markets", tags=["Markets"])


@router.get(
    "/prices",
    response_model=MarketPricesResponse,
    responses={422: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
    summary="Historical prices, normalized/common-start indices, crossovers, and buy-and-hold",
)
def market_prices(
    start_date: Optional[datetime.date] = Query(
        default=None, description="Inclusive start date (YYYY-MM-DD)."
    ),
    end_date: Optional[datetime.date] = Query(
        default=None, description="Inclusive end date (YYYY-MM-DD)."
    ),
    initial_capital: float = Query(
        default=1480.0,
        ge=1.0,
        le=1_000_000_000.0,
        description="Initial capital in USD for buy-and-hold calculations.",
    ),
) -> MarketPricesResponse:
    """Return historical BTC/ETH/SOL prices and comparative indices without forward-filling SOL."""
    return get_market_prices(
        start_date=start_date,
        end_date=end_date,
        initial_capital=initial_capital,
    )


@router.get(
    "/summary",
    response_model=MarketSummaryResponse,
    responses={422: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
    summary="Latest closes and per-asset data quality summary",
)
def market_summary(
    start_date: Optional[datetime.date] = Query(
        default=None, description="Inclusive start date (YYYY-MM-DD)."
    ),
    end_date: Optional[datetime.date] = Query(
        default=None, description="Inclusive end date (YYYY-MM-DD)."
    ),
) -> MarketSummaryResponse:
    """Return latest available closing prices and data integrity checks."""
    return get_market_summary(start_date=start_date, end_date=end_date)

