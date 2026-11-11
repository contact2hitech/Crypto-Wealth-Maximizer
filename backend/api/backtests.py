"""Distinct backtest endpoints for constrained, comparison, practical, and hindsight workflows."""

from __future__ import annotations

from fastapi import APIRouter

from backend.schemas.backtests import (
    ConstrainedBacktestRequest,
    ConstrainedBacktestResponse,
    HindsightOptimizerRequest,
    HindsightOptimizerResponse,
    PracticalBacktestRequest,
    PracticalBacktestResponse,
    ProtectionCompareRequest,
    ProtectionCompareResponse,
)
from backend.schemas.common import ErrorResponse
from backend.services.backtest_service import (
    compare_protection_workflow,
    run_constrained_workflow,
    run_hindsight_workflow,
    run_practical_workflow,
)

router = APIRouter(prefix="/api/backtest", tags=["Backtests"])


@router.post(
    "/run",
    response_model=ConstrainedBacktestResponse,
    responses={422: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
    summary="Run constrained backtest (evaluation-window indicator warm-up, v1.0 parity)",
)
def run_constrained_backtest_endpoint(
    payload: ConstrainedBacktestRequest,
) -> ConstrainedBacktestResponse:
    """Execute optimization_engine.run_constrained_backtest over the selected date window.

    Note (KI-006 parity): Consistent with v1.0 app.py, the canonical dataset is sliced to
    [start_date, end_date] before computing indicators (indicator_history=None).
    """
    return run_constrained_workflow(payload)


@router.post(
    "/compare",
    response_model=ProtectionCompareResponse,
    responses={422: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
    summary="Compare all four protection modes against BTC/ETH/SOL buy-and-hold benchmarks",
)
def compare_protection_modes_endpoint(
    payload: ProtectionCompareRequest,
) -> ProtectionCompareResponse:
    """Execute optimization_engine.compare_protection_modes over the selected date window."""
    return compare_protection_workflow(payload)


@router.post(
    "/practical",
    response_model=PracticalBacktestResponse,
    responses={422: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
    summary="Run practical no-lookahead baseline strategies A, B, and C",
)
def run_practical_strategies_endpoint(
    payload: PracticalBacktestRequest,
) -> PracticalBacktestResponse:
    """Execute strategy_engine.run_practical_strategies (fully invested, no cash filter)."""
    return run_practical_workflow(payload)


@router.post(
    "/hindsight",
    response_model=HindsightOptimizerResponse,
    responses={422: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
    summary="Run perfect-hindsight DP optimizer (non-investable upper-bound experiment)",
)
def run_hindsight_optimizer_endpoint(
    payload: HindsightOptimizerRequest,
) -> HindsightOptimizerResponse:
    """Execute crypto_engine.optimal_switching with explicit is_hindsight_upper_bound=true."""
    return run_hindsight_workflow(payload)

