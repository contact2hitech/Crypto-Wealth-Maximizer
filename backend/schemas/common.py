"""Shared literal enums, error schemas, and common structural models."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

StrategyName = Literal[
    "A: 90-day momentum",
    "B: 50/200-day trend + momentum",
    "C: 30/90/180-day momentum",
]

RebalanceFrequency = Literal["Daily", "Weekly", "Every 15 days", "Monthly"]

InitializationMode = Literal[
    "Invest immediately in Bitcoin",
    "Wait for first valid signal",
]

AssetName = Literal["Bitcoin", "Ethereum", "Solana"]
HoldingName = Literal["Bitcoin", "Ethereum", "Solana", "USD Cash"]


class DateRangeInfo(BaseModel):
    """Observed date coverage and row count for a returned dataset or backtest slice."""

    start_date: str
    end_date: str
    row_count: int


class ErrorDetail(BaseModel):
    """Structured API error payload without internal tracebacks."""

    code: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)


class ErrorResponse(BaseModel):
    """Consistent error envelope returned for HTTP exceptions."""

    error: ErrorDetail

