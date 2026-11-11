"""Schemas for POST /api/robustness/analyze endpoint."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel

from backend.schemas.backtests import ConstrainedConfigBase
from backend.schemas.common import DateRangeInfo
from backend.schemas.risk import DrawdownExitEvent, EventCountSummary


class RobustnessAnalyzeRequest(ConstrainedConfigBase):
    """Request payload for POST /api/robustness/analyze."""

    enable_cash_filter: bool = True
    enable_drawdown_protection: bool = True
    walk_forward_cash_filter: Optional[bool] = None
    include_sensitivity: bool = True


class WalkForwardPeriodRow(BaseModel):
    """Independent period evaluation row from optimization_engine.walk_forward_report."""

    period: str
    start_date: str
    end_date: str
    strategy: str
    final_value_usd: Optional[float] = None
    total_return_pct: Optional[float] = None
    cagr_pct: Optional[float] = None
    maximum_drawdown_pct: Optional[float] = None
    lifetime_max_drawdown_pct: Optional[float] = None
    annualized_volatility_pct: Optional[float] = None
    sharpe_rf0: Optional[float] = None
    switches: int
    cash_days: int


class WalkForwardSection(BaseModel):
    """Fixed Development/Validation/Test walk-forward section on the full canonical dataset."""

    uses_full_canonical_dataset: Literal[True] = True
    is_independent_periods: Literal[True] = True
    note: str
    periods: list[WalkForwardPeriodRow]


class RegimePerformanceRow(BaseModel):
    """Portfolio metrics grouped by causal BTC market regime."""

    market_regime: str
    days: int
    portfolio_return_in_regime_pct: Optional[float] = None
    average_daily_return_pct: Optional[float] = None
    positive_days_pct: Optional[float] = None
    cash_days: int


class AssetAttributionRow(BaseModel):
    """Exposure and return attribution row from robustness_engine.asset_attribution."""

    holding: str
    days_held: int
    exposure_pct: Optional[float] = None
    compounded_return_during_holding_days_pct: Optional[float] = None
    sum_of_daily_portfolio_returns_pct: Optional[float] = None
    positive_holding_days_pct: Optional[float] = None


class SensitivityRow(BaseModel):
    """Predeclared 3x3 sensitivity row from robustness_engine.parameter_sensitivity."""

    sensitivity_strategy: str
    drawdown_trigger_pct: float
    final_value_usd: Optional[float] = None
    total_return_pct: Optional[float] = None
    cagr_pct: Optional[float] = None
    maximum_drawdown_pct: Optional[float] = None
    annualized_volatility_pct: Optional[float] = None
    sharpe_rf0: Optional[float] = None
    switches: int
    cash_days: int


class RobustnessAnalyzeResponse(BaseModel):
    """Response payload for POST /api/robustness/analyze."""

    workflow: Literal["robustness_analysis"] = "robustness_analysis"
    configuration: RobustnessAnalyzeRequest
    evaluation_date_range: DateRangeInfo
    walk_forward: WalkForwardSection
    market_regimes: list[RegimePerformanceRow]
    asset_attribution: list[AssetAttributionRow]
    protection_event_summary: list[EventCountSummary]
    drawdown_exits: list[DrawdownExitEvent]
    parameter_sensitivity: Optional[list[SensitivityRow]] = None
    limitations: list[str]

