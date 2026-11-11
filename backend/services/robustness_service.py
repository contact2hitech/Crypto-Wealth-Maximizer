"""Robustness service wrapping walk-forward, regimes, attribution, and sensitivity grid."""

from __future__ import annotations

from backend.core.data_loader import get_dataset_snapshot, slice_prices
from backend.core.exceptions import EngineValidationError
from backend.core.serialization import clean_float
from backend.schemas.robustness import (
    AssetAttributionRow,
    RegimePerformanceRow,
    RobustnessAnalyzeRequest,
    RobustnessAnalyzeResponse,
    SensitivityRow,
    WalkForwardPeriodRow,
    WalkForwardSection,
)
from backend.services.cache import response_cache
from backend.services.common import (
    STANDARD_LIMITATIONS,
    build_date_range_info,
    compute_protection_summaries,
)
from optimization_engine import run_constrained_backtest, walk_forward_report
from robustness_engine import asset_attribution, parameter_sensitivity, regime_performance

WALK_FORWARD_SPLITS = {
    "Development": ("2016-11-09", "2022-12-31"),
    "Validation": ("2023-01-01", "2024-12-31"),
    "Test": ("2025-01-01", "2026-11-09"),
}


def analyze_robustness(req: RobustnessAnalyzeRequest) -> RobustnessAnalyzeResponse:
    """Execute walk-forward (full dataset) plus regime, attribution, exit, and sensitivity analysis."""
    snapshot = get_dataset_snapshot()
    end_iso = req.end_date.isoformat() if req.end_date else None
    effective_dd = float(req.drawdown_protection_pct) if req.enable_drawdown_protection else 0.0
    wf_cash_filter = (
        bool(req.walk_forward_cash_filter)
        if req.walk_forward_cash_filter is not None
        else bool(req.enable_cash_filter)
    )

    key = (
        "robustness_analyze",
        snapshot.metadata.fingerprint,
        req.strategy,
        float(req.initial_capital),
        req.start_date.isoformat(),
        end_iso,
        req.rebalance_frequency,
        int(req.minimum_holding_days),
        float(req.switching_threshold_pct),
        float(req.fee_bps_per_switch),
        bool(req.enable_cash_filter),
        bool(req.enable_drawdown_protection),
        float(req.drawdown_protection_pct),
        float(req.cash_reentry_score_pct),
        req.initialization_mode,
        wf_cash_filter,
        bool(req.include_sensitivity),
    )

    def _compute() -> RobustnessAnalyzeResponse:
        full_prices = snapshot.prices
        sliced = slice_prices(full_prices, req.start_date, req.end_date)

        try:
            # Per KI-006 review mandate: walk-forward always uses full canonical dataset
            # and fixed Development/Validation/Test splits regardless of dashboard date filter.
            wf_df = walk_forward_report(
                full_prices,
                strategy=req.strategy,
                initial_capital=float(req.initial_capital),
                fee_bps_per_switch=float(req.fee_bps_per_switch),
                rebalance_frequency=req.rebalance_frequency,
                minimum_holding_days=int(req.minimum_holding_days),
                switching_threshold_pct=float(req.switching_threshold_pct),
                allow_cash=True,
                drawdown_protection_pct=effective_dd,
                cash_filter=wf_cash_filter,
                cash_reentry_score_pct=float(req.cash_reentry_score_pct),
                initialization_mode=req.initialization_mode,
            )

            robust_res = run_constrained_backtest(
                sliced,
                strategy=req.strategy,
                initial_capital=float(req.initial_capital),
                start_date=req.start_date.isoformat(),
                end_date=end_iso,
                rebalance_frequency=req.rebalance_frequency,
                minimum_holding_days=int(req.minimum_holding_days),
                switching_threshold_pct=float(req.switching_threshold_pct),
                fee_bps_per_switch=float(req.fee_bps_per_switch),
                allow_cash=True,
                cash_when_no_positive_score=bool(req.enable_cash_filter),
                drawdown_protection_pct=effective_dd,
                cash_reentry_score_pct=float(req.cash_reentry_score_pct),
                indicator_history=None,
                initialization_mode=req.initialization_mode,
            )
        except ValueError as exc:
            raise EngineValidationError(str(exc)) from exc

        robust_key = next(iter(robust_res.equity_curves))
        robust_equity = robust_res.equity_curves[robust_key]
        robust_holdings = robust_res.holdings[robust_key]
        robust_events = robust_res.diagnostics[robust_key]

        wf_rows: list[WalkForwardPeriodRow] = []
        for _, row in wf_df.iterrows():
            period_name = str(row["Period"])
            p_start, p_end = WALK_FORWARD_SPLITS.get(period_name, ("", ""))
            wf_rows.append(
                WalkForwardPeriodRow(
                    period=period_name,
                    start_date=p_start,
                    end_date=p_end,
                    strategy=str(row["Strategy"]),
                    final_value_usd=clean_float(row.get("Final value (USD)")),
                    total_return_pct=clean_float(row.get("Total return (%)")),
                    cagr_pct=clean_float(row.get("CAGR (%)")),
                    maximum_drawdown_pct=clean_float(row.get("Maximum drawdown (%)")),
                    lifetime_max_drawdown_pct=clean_float(row.get("Lifetime max drawdown (%)")),
                    annualized_volatility_pct=clean_float(row.get("Annualized volatility (%)")),
                    sharpe_rf0=clean_float(row.get("Sharpe (rf=0)")),
                    switches=int(row["Switches"]),
                    cash_days=int(row["Cash days"]),
                )
            )

        regimes_df = regime_performance(sliced, robust_equity, robust_holdings)
        regime_rows = [
            RegimePerformanceRow(
                market_regime=str(row["Market regime"]),
                days=int(row["Days"]),
                portfolio_return_in_regime_pct=clean_float(row.get("Portfolio return in regime (%)")),
                average_daily_return_pct=clean_float(row.get("Average daily return (%)")),
                positive_days_pct=clean_float(row.get("Positive days (%)")),
                cash_days=int(row["Cash days"]),
            )
            for _, row in regimes_df.iterrows()
        ]

        attr_df = asset_attribution(robust_equity, robust_holdings)
        attr_rows = [
            AssetAttributionRow(
                holding=str(row["Holding"]),
                days_held=int(row["Days held"]),
                exposure_pct=clean_float(row.get("Exposure (%)")),
                compounded_return_during_holding_days_pct=clean_float(
                    row.get("Compounded return during holding days (%)")
                ),
                sum_of_daily_portfolio_returns_pct=clean_float(
                    row.get("Sum of daily portfolio returns (%)")
                ),
                positive_holding_days_pct=clean_float(row.get("Positive holding days (%)")),
            )
            for _, row in attr_df.iterrows()
        ]

        event_summary, drawdown_exits, _ = compute_protection_summaries(
            robust_events, effective_dd
        )

        sens_rows: list[SensitivityRow] | None = None
        if req.include_sensitivity:
            try:
                sens_df = parameter_sensitivity(
                    sliced,
                    initial_capital=float(req.initial_capital),
                    start_date=req.start_date.isoformat(),
                    end_date=end_iso,
                    rebalance_frequency=req.rebalance_frequency,
                    minimum_holding_days=int(req.minimum_holding_days),
                    switching_threshold_pct=float(req.switching_threshold_pct),
                    fee_bps_per_switch=float(req.fee_bps_per_switch),
                    cash_reentry_score_pct=float(req.cash_reentry_score_pct),
                    initialization_mode=req.initialization_mode,
                )
            except ValueError as exc:
                raise EngineValidationError(str(exc)) from exc

            sens_rows = [
                SensitivityRow(
                    sensitivity_strategy=str(row["Sensitivity strategy"]),
                    drawdown_trigger_pct=float(row["Drawdown trigger (%)"]),
                    final_value_usd=clean_float(row.get("Final value (USD)")),
                    total_return_pct=clean_float(row.get("Total return (%)")),
                    cagr_pct=clean_float(row.get("CAGR (%)")),
                    maximum_drawdown_pct=clean_float(row.get("Maximum drawdown (%)")),
                    annualized_volatility_pct=clean_float(row.get("Annualized volatility (%)")),
                    sharpe_rf0=clean_float(row.get("Sharpe (rf=0)")),
                    switches=int(row["Switches"]),
                    cash_days=int(row["Cash days"]),
                )
                for _, row in sens_df.iterrows()
            ]

        return RobustnessAnalyzeResponse(
            configuration=req.model_copy(deep=True),
            evaluation_date_range=build_date_range_info(sliced),
            walk_forward=WalkForwardSection(
                note=(
                    "Walk-forward periods use the full canonical dataset for indicator warm-up up to "
                    "each period end, and reset capital at each period start. They are independent tests, "
                    "not a continuous funded account."
                ),
                periods=wf_rows,
            ),
            market_regimes=regime_rows,
            asset_attribution=attr_rows,
            protection_event_summary=event_summary,
            drawdown_exits=drawdown_exits,
            parameter_sensitivity=sens_rows,
            limitations=[
                *STANDARD_LIMITATIONS,
                "Regime-conditioned compounded returns combine non-contiguous historical days and are not independent investable periods.",
                "Asset exposure attribution describes portfolio daily returns during holding days and is not a complete causal profit decomposition.",
                "Sensitivity grid results are descriptive only and must not be used to retroactively overfit a parameter winner.",
            ],
        )

    return response_cache.get_or_compute(key, _compute)

