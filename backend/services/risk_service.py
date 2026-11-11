"""Risk protection diagnostics and daily drawdown execution trace service."""

from __future__ import annotations

from backend.core.data_loader import get_dataset_snapshot, slice_prices
from backend.core.exceptions import EngineValidationError
from backend.schemas.risk import RiskProtectionRequest, RiskProtectionResponse
from backend.services.cache import response_cache
from backend.services.common import (
    STANDARD_LIMITATIONS,
    build_date_range_info,
    compute_protection_summaries,
    map_constrained_summary,
    map_diagnostics_df,
    map_trace_df,
)
from optimization_engine import run_constrained_backtest

RISK_EXECUTION_CAVEAT = (
    "Daily-close drawdown protection is detected only after a daily close-to-close return "
    "has already occurred and assumes execution at that same daily close. It is NOT an "
    "intraday stop-loss and cannot prevent gap losses or overshoot beyond the configured trigger."
)


def analyze_risk_protection(req: RiskProtectionRequest) -> RiskProtectionResponse:
    """Run constrained backtest and compute protection exit/overshoot diagnostics and daily trace."""
    snapshot = get_dataset_snapshot()
    end_iso = req.end_date.isoformat() if req.end_date else None
    effective_dd_pct = float(req.drawdown_protection_pct) if req.enable_drawdown_protection else 0.0
    key = (
        "risk_protection",
        snapshot.metadata.fingerprint,
        req.strategy,
        float(req.initial_capital),
        req.start_date.isoformat(),
        end_iso,
        req.rebalance_frequency,
        int(req.minimum_holding_days),
        float(req.switching_threshold_pct),
        float(req.fee_bps_per_switch),
        bool(req.allow_cash),
        bool(req.enable_cash_filter),
        bool(req.enable_drawdown_protection),
        float(req.drawdown_protection_pct),
        float(req.cash_reentry_score_pct),
        req.initialization_mode,
        bool(req.include_daily_trace),
    )

    def _compute() -> RiskProtectionResponse:
        sliced = slice_prices(snapshot.prices, req.start_date, req.end_date)
        try:
            res = run_constrained_backtest(
                sliced,
                strategy=req.strategy,
                initial_capital=float(req.initial_capital),
                start_date=req.start_date.isoformat(),
                end_date=end_iso,
                rebalance_frequency=req.rebalance_frequency,
                minimum_holding_days=int(req.minimum_holding_days),
                switching_threshold_pct=float(req.switching_threshold_pct),
                fee_bps_per_switch=float(req.fee_bps_per_switch),
                allow_cash=bool(req.allow_cash),
                cash_when_no_positive_score=bool(req.enable_cash_filter),
                drawdown_protection_pct=float(req.drawdown_protection_pct),
                cash_reentry_score_pct=float(req.cash_reentry_score_pct),
                indicator_history=None,
                enable_cash_filter=bool(req.enable_cash_filter),
                enable_drawdown_protection=bool(req.enable_drawdown_protection),
                initialization_mode=req.initialization_mode,
            )
        except ValueError as exc:
            raise EngineValidationError(str(exc)) from exc

        result_key = next(iter(res.equity_curves))
        summary = map_constrained_summary(res.summary.iloc[0].to_dict())
        diag_df = res.diagnostics[result_key]
        event_summary, drawdown_exits, exit_metrics = compute_protection_summaries(
            diag_df, effective_dd_pct
        )
        all_diagnostics = map_diagnostics_df(diag_df)
        daily_trace = map_trace_df(res.drawdown_traces[result_key]) if req.include_daily_trace else None

        return RiskProtectionResponse(
            configuration=req.model_copy(deep=True),
            date_range=build_date_range_info(sliced),
            summary=summary,
            event_summary=event_summary,
            exit_metrics=exit_metrics,
            drawdown_exits=drawdown_exits,
            all_diagnostics=all_diagnostics,
            daily_trace=daily_trace,
            execution_caveat=RISK_EXECUTION_CAVEAT,
            assumptions_and_limitations=list(STANDARD_LIMITATIONS),
        )

    return response_cache.get_or_compute(key, _compute)

