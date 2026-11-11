"""Schemas for POST /api/risk/protection endpoint."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel

from backend.schemas.backtests import (
    ConstrainedConfigBase,
    ConstrainedSummaryRow,
    DiagnosticEventRow,
    DrawdownTraceRow,
)
from backend.schemas.common import DateRangeInfo


class RiskProtectionRequest(ConstrainedConfigBase):
    """Request payload for POST /api/risk/protection."""

    allow_cash: bool = True
    enable_cash_filter: bool = True
    enable_drawdown_protection: bool = True
    include_daily_trace: bool = True


class EventCountSummary(BaseModel):
    """Aggregated protection/allocation event summary from robustness_engine.protection_effectiveness."""

    event: str
    events: int
    mean_drawdown_pct: Optional[float] = None
    worst_drawdown_pct: Optional[float] = None
    median_drawdown_pct: Optional[float] = None


class DrawdownExitEvent(BaseModel):
    """Drawdown protection exit event with overshoot beyond configured daily-close trigger."""

    date: str
    event: str
    from_asset: str
    to_asset: str
    portfolio_value_usd: Optional[float] = None
    peak_portfolio_value_usd: Optional[float] = None
    drawdown_pct: Optional[float] = None
    best_asset: Optional[str] = None
    best_score_pct: Optional[float] = None
    scheduled_rebalance: bool
    overshoot_beyond_configured_trigger_pp: Optional[float] = None


class ExitMetricsSummary(BaseModel):
    """Summary statistics across drawdown protection exits."""

    total_drawdown_exits: int
    average_exit_drawdown_pct: Optional[float] = None
    median_exit_drawdown_pct: Optional[float] = None
    worst_exit_drawdown_pct: Optional[float] = None
    worst_exit_date: Optional[str] = None
    average_overshoot_pp: Optional[float] = None
    max_overshoot_pp: Optional[float] = None


class RiskProtectionResponse(BaseModel):
    """Response payload for POST /api/risk/protection."""

    workflow: Literal["risk_protection_analysis"] = "risk_protection_analysis"
    warmup_mode: Literal["evaluation_window_only"] = "evaluation_window_only"
    configuration: RiskProtectionRequest
    date_range: DateRangeInfo
    summary: ConstrainedSummaryRow
    event_summary: list[EventCountSummary]
    exit_metrics: ExitMetricsSummary
    drawdown_exits: list[DrawdownExitEvent]
    all_diagnostics: list[DiagnosticEventRow]
    daily_trace: Optional[list[DrawdownTraceRow]] = None
    execution_caveat: str
    assumptions_and_limitations: list[str]

