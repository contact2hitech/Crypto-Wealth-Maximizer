"""Schemas for constrained backtest, protection comparison, practical strategies, and hindsight optimizer."""

from __future__ import annotations

import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator

from backend.schemas.common import (
    DateRangeInfo,
    InitializationMode,
    RebalanceFrequency,
    StrategyName,
)


class ConstrainedConfigBase(BaseModel):
    """Shared validated parameters matching v1.0 Section 9 defaults."""

    strategy: StrategyName = "A: 90-day momentum"
    initial_capital: float = Field(default=1480.0, ge=1.0, le=1_000_000_000.0)
    start_date: datetime.date = datetime.date(2016, 11, 9)
    end_date: Optional[datetime.date] = datetime.date(2026, 11, 10)
    rebalance_frequency: RebalanceFrequency = "Monthly"
    minimum_holding_days: int = Field(default=30, ge=0, le=365)
    switching_threshold_pct: float = Field(default=10.0, ge=0.0, le=100.0)
    fee_bps_per_switch: float = Field(default=10.0, ge=0.0, le=1000.0)
    drawdown_protection_pct: float = Field(default=20.0, ge=0.0, le=99.0)
    cash_reentry_score_pct: float = Field(default=0.0, ge=-50.0, le=100.0)
    initialization_mode: InitializationMode = "Invest immediately in Bitcoin"

    @model_validator(mode="after")
    def validate_dates(self) -> "ConstrainedConfigBase":
        if self.end_date is not None and self.start_date > self.end_date:
            raise ValueError("start_date must be on or before end_date.")
        return self


class ConstrainedBacktestRequest(ConstrainedConfigBase):
    """Request payload for POST /api/backtest/run."""

    allow_cash: bool = True
    enable_cash_filter: bool = True
    enable_drawdown_protection: bool = True
    include_benchmarks: bool = True
    include_daily_trace: bool = False


class ProtectionCompareRequest(ConstrainedConfigBase):
    """Request payload for POST /api/backtest/compare."""

    include_curves: bool = True
    include_details: bool = True


class PracticalBacktestRequest(BaseModel):
    """Request payload for POST /api/backtest/practical (no-lookahead Strategies A, B, C)."""

    initial_capital: float = Field(default=1480.0, ge=1.0, le=1_000_000_000.0)
    start_date: datetime.date = datetime.date(2016, 11, 9)
    end_date: Optional[datetime.date] = datetime.date(2026, 11, 10)
    fee_bps_per_switch: float = Field(default=0.0, ge=0.0, le=1000.0)

    @model_validator(mode="after")
    def validate_dates(self) -> "PracticalBacktestRequest":
        if self.end_date is not None and self.start_date > self.end_date:
            raise ValueError("start_date must be on or before end_date.")
        return self


class HindsightOptimizerRequest(BaseModel):
    """Request payload for POST /api/backtest/hindsight (perfect-hindsight upper bound)."""

    initial_capital: float = Field(default=1480.0, ge=1.0, le=1_000_000_000.0)
    start_date: datetime.date = datetime.date(2016, 11, 9)
    end_date: Optional[datetime.date] = datetime.date(2026, 11, 10)
    max_switches: int = Field(default=5, ge=0, le=10)

    @model_validator(mode="after")
    def validate_dates(self) -> "HindsightOptimizerRequest":
        if self.end_date is not None and self.start_date > self.end_date:
            raise ValueError("start_date must be on or before end_date.")
        return self


class ConstrainedSummaryRow(BaseModel):
    """Summary metrics produced by optimization_engine.run_constrained_backtest."""

    strategy: str
    rebalance: str
    minimum_hold_days: int
    switch_threshold_pct: float
    fee_per_switch_bps: float
    cash_enabled: bool
    cash_filter: bool
    drawdown_protection_pct: float
    initialization_mode: str
    lifetime_max_drawdown_pct: Optional[float] = None
    final_value_usd: Optional[float] = None
    total_return_pct: Optional[float] = None
    cagr_pct: Optional[float] = None
    maximum_drawdown_pct: Optional[float] = None
    annualized_volatility_pct: Optional[float] = None
    sharpe_rf0: Optional[float] = None
    switches: int
    cash_days: int


class EquityPoint(BaseModel):
    """Daily portfolio equity, underwater drawdown, and end-of-day holding."""

    date: str
    value_usd: Optional[float] = None
    drawdown_pct: Optional[float] = None
    holding: str


class BenchmarkPoint(BaseModel):
    """Daily buy-and-hold equity and drawdown point."""

    date: str
    value_usd: Optional[float] = None
    drawdown_pct: Optional[float] = None


class BenchmarkSummaryRow(BaseModel):
    """Buy-and-hold benchmark metrics from optimization_engine.run_benchmark."""

    strategy: str
    final_value_usd: Optional[float] = None
    total_return_pct: Optional[float] = None
    cagr_pct: Optional[float] = None
    maximum_drawdown_pct: Optional[float] = None
    annualized_volatility_pct: Optional[float] = None
    sharpe_rf0: Optional[float] = None
    switches: int
    cash_days: int


class ConstrainedTradeRow(BaseModel):
    """Position change recorded by optimization_engine.run_constrained_backtest."""

    signal_date: str
    signal_execution_date: str
    from_asset: str
    to_asset: str
    reason: Optional[str] = None
    portfolio_value_after_fee_usd: Optional[float] = None
    peak_before_decision_usd: Optional[float] = None
    drawdown_at_decision_pct: Optional[float] = None
    best_asset: Optional[str] = None
    best_score_pct: Optional[float] = None


class DiagnosticEventRow(BaseModel):
    """Risk or allocation event recorded by optimization_engine."""

    date: str
    event: Optional[str] = None
    from_asset: str
    to_asset: str
    portfolio_value_usd: Optional[float] = None
    peak_portfolio_value_usd: Optional[float] = None
    drawdown_pct: Optional[float] = None
    best_asset: Optional[str] = None
    best_score_pct: Optional[float] = None
    scheduled_rebalance: bool


class DrawdownTraceRow(BaseModel):
    """One row per evaluation day from Phase 4.4.1 daily drawdown execution trace."""

    date: str
    holding_during_interval: str
    holding_before_decision: str
    previous_close_portfolio_value_usd: Optional[float] = None
    portfolio_value_before_decision_usd: Optional[float] = None
    previous_high_water_mark_usd: Optional[float] = None
    high_water_mark_before_decision_usd: Optional[float] = None
    high_water_mark_updated_today: bool
    close_to_close_portfolio_return_pct: Optional[float] = None
    drawdown_before_decision_pct: Optional[float] = None
    protection_threshold_pct: Optional[float] = None
    drawdown_trigger_breached: bool
    scheduled_rebalance: bool
    decision: str
    holding_after_decision: str
    execution_assumption: str
    fee_rate_bps: float


class ConstrainedBacktestResponse(BaseModel):
    """Response payload for POST /api/backtest/run."""

    workflow: Literal["constrained_backtest"] = "constrained_backtest"
    warmup_mode: Literal["evaluation_window_only"] = "evaluation_window_only"
    configuration: ConstrainedBacktestRequest
    date_range: DateRangeInfo
    summary: ConstrainedSummaryRow
    equity_curve: list[EquityPoint]
    benchmark_summaries: list[BenchmarkSummaryRow]
    benchmark_curves: dict[str, list[BenchmarkPoint]]
    trades: list[ConstrainedTradeRow]
    diagnostics: list[DiagnosticEventRow]
    drawdown_trace: Optional[list[DrawdownTraceRow]] = None
    assumptions_and_limitations: list[str]


class ProtectionCompareRow(BaseModel):
    """Summary row from optimization_engine.compare_protection_modes."""

    experiment: str
    strategy: str
    rebalance: Optional[str] = None
    minimum_hold_days: Optional[int] = None
    switch_threshold_pct: Optional[float] = None
    fee_per_switch_bps: Optional[float] = None
    cash_enabled: Optional[bool] = None
    cash_filter: Optional[bool] = None
    drawdown_protection_pct: Optional[float] = None
    initialization_mode: Optional[str] = None
    lifetime_max_drawdown_pct: Optional[float] = None
    final_value_usd: Optional[float] = None
    total_return_pct: Optional[float] = None
    cagr_pct: Optional[float] = None
    maximum_drawdown_pct: Optional[float] = None
    annualized_volatility_pct: Optional[float] = None
    sharpe_rf0: Optional[float] = None
    switches: int
    cash_days: int


class ProtectionCompareResponse(BaseModel):
    """Response payload for POST /api/backtest/compare."""

    workflow: Literal["protection_mode_comparison"] = "protection_mode_comparison"
    warmup_mode: Literal["evaluation_window_only"] = "evaluation_window_only"
    configuration: ProtectionCompareRequest
    date_range: DateRangeInfo
    comparison: list[ProtectionCompareRow]
    curves: dict[str, list[BenchmarkPoint]]
    holdings_by_mode: dict[str, list[EquityPoint]]
    trades_by_mode: dict[str, list[ConstrainedTradeRow]]
    diagnostics_by_mode: dict[str, list[DiagnosticEventRow]]
    assumptions_and_limitations: list[str]


class PracticalSummaryRow(BaseModel):
    """Summary row from strategy_engine.run_practical_strategies."""

    strategy: str
    final_value_usd: Optional[float] = None
    total_return_pct: Optional[float] = None
    cagr_pct: Optional[float] = None
    maximum_drawdown_pct: Optional[float] = None
    annualized_volatility_pct: Optional[float] = None
    sharpe_rf0_daily: Optional[float] = None
    switches: int


class PracticalTradeRow(BaseModel):
    """Trade switch row from strategy_engine.run_practical_strategies."""

    date: str
    from_asset: str
    to_asset: str


class PracticalHoldingPoint(BaseModel):
    """Daily equity and holding point for practical strategies."""

    date: str
    value_usd: Optional[float] = None
    drawdown_pct: Optional[float] = None
    holding: Optional[str] = None


class PracticalBacktestResponse(BaseModel):
    """Response payload for POST /api/backtest/practical."""

    workflow: Literal["practical_strategies"] = "practical_strategies"
    configuration: PracticalBacktestRequest
    date_range: DateRangeInfo
    summary: list[PracticalSummaryRow]
    equity_curves: dict[str, list[PracticalHoldingPoint]]
    trades: dict[str, list[PracticalTradeRow]]
    assumptions_and_limitations: list[str]


class HindsightSummaryRow(BaseModel):
    """Summary row for one switch cap from crypto_engine.optimal_switching."""

    maximum_switches: int
    actual_switches: int
    final_value_usd: float
    profit_usd: float
    return_pct: float
    ending_asset: str
    maximum_drawdown_pct: Optional[float] = None


class HindsightSwitchEvent(BaseModel):
    """One perfect-hindsight switch event."""

    date: str
    switch_into: str


class HindsightOptimizerResponse(BaseModel):
    """Response payload for POST /api/backtest/hindsight."""

    workflow: Literal["perfect_hindsight_optimizer"] = "perfect_hindsight_optimizer"
    is_hindsight_upper_bound: Literal[True] = True
    is_investable: Literal[False] = False
    warning: str
    configuration: HindsightOptimizerRequest
    date_range: DateRangeInfo
    summary: list[HindsightSummaryRow]
    paths: dict[str, list[HindsightSwitchEvent]]
    equity_curves: dict[str, list[BenchmarkPoint]]

