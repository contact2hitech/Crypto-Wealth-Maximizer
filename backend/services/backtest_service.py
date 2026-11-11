"""Backtest service wrapping constrained, comparison, practical, and hindsight workflows."""

from __future__ import annotations

import pandas as pd

from backend.core.data_loader import get_dataset_snapshot, slice_prices
from backend.core.exceptions import EngineValidationError
from backend.core.serialization import clean_bool, clean_float, format_date
from backend.schemas.backtests import (
    BenchmarkPoint,
    BenchmarkSummaryRow,
    ConstrainedBacktestRequest,
    ConstrainedBacktestResponse,
    ConstrainedTradeRow,
    DiagnosticEventRow,
    EquityPoint,
    HindsightOptimizerRequest,
    HindsightOptimizerResponse,
    HindsightSummaryRow,
    HindsightSwitchEvent,
    PracticalBacktestRequest,
    PracticalBacktestResponse,
    PracticalHoldingPoint,
    PracticalSummaryRow,
    PracticalTradeRow,
    ProtectionCompareRequest,
    ProtectionCompareResponse,
    ProtectionCompareRow,
)
from backend.services.cache import response_cache
from backend.services.common import (
    STANDARD_LIMITATIONS,
    build_date_range_info,
    map_benchmark_curve,
    map_constrained_summary,
    map_diagnostics_df,
    map_equity_and_holdings,
    map_trace_df,
    map_trades_df,
)
from crypto_engine import max_drawdown, optimal_switching
from optimization_engine import (
    compare_protection_modes,
    run_benchmark,
    run_constrained_backtest,
)
from strategy_engine import run_practical_strategies

HINDSIGHT_WARNING = (
    "Perfect-hindsight dynamic programming uses full knowledge of future prices. "
    "It is a non-investable theoretical upper-bound experiment, not a usable trading strategy."
)


def run_constrained_workflow(req: ConstrainedBacktestRequest) -> ConstrainedBacktestResponse:
    """Execute a constrained backtest using the date-sliced DataFrame (v1.0 parity)."""
    snapshot = get_dataset_snapshot()
    end_iso = req.end_date.isoformat() if req.end_date else None
    key = (
        "constrained_backtest",
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
        bool(req.include_benchmarks),
        bool(req.include_daily_trace),
    )

    def _compute() -> ConstrainedBacktestResponse:
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
        equity_curve = map_equity_and_holdings(
            res.equity_curves[result_key], res.holdings[result_key]
        )
        trades = map_trades_df(res.trades[result_key])
        diagnostics = map_diagnostics_df(res.diagnostics[result_key])
        trace = map_trace_df(res.drawdown_traces[result_key]) if req.include_daily_trace else None

        benchmark_summaries: list[BenchmarkSummaryRow] = []
        benchmark_curves: dict[str, list[BenchmarkPoint]] = {}
        if req.include_benchmarks:
            for asset in ("Bitcoin", "Ethereum", "Solana"):
                try:
                    row_df, curve = run_benchmark(
                        sliced,
                        asset,
                        initial_capital=float(req.initial_capital),
                        start_date=req.start_date.isoformat(),
                        end_date=end_iso,
                    )
                except ValueError:
                    continue
                row = row_df.iloc[0].to_dict()
                benchmark_summaries.append(
                    BenchmarkSummaryRow(
                        strategy=str(row["Strategy"]),
                        final_value_usd=clean_float(row.get("Final value (USD)")),
                        total_return_pct=clean_float(row.get("Total return (%)")),
                        cagr_pct=clean_float(row.get("CAGR (%)")),
                        maximum_drawdown_pct=clean_float(row.get("Maximum drawdown (%)")),
                        annualized_volatility_pct=clean_float(row.get("Annualized volatility (%)")),
                        sharpe_rf0=clean_float(row.get("Sharpe (rf=0)")),
                        switches=int(row["Switches"]),
                        cash_days=int(row["Cash days"]),
                    )
                )
                benchmark_curves[asset] = map_benchmark_curve(curve)

        return ConstrainedBacktestResponse(
            configuration=req.model_copy(deep=True),
            date_range=build_date_range_info(sliced),
            summary=summary,
            equity_curve=equity_curve,
            benchmark_summaries=benchmark_summaries,
            benchmark_curves=benchmark_curves,
            trades=trades,
            diagnostics=diagnostics,
            drawdown_trace=trace,
            assumptions_and_limitations=list(STANDARD_LIMITATIONS),
        )

    return response_cache.get_or_compute(key, _compute)


def compare_protection_workflow(req: ProtectionCompareRequest) -> ProtectionCompareResponse:
    """Run four protection experiments plus buy-and-hold benchmarks via optimization_engine."""
    snapshot = get_dataset_snapshot()
    end_iso = req.end_date.isoformat() if req.end_date else None
    key = (
        "compare_protection_modes",
        snapshot.metadata.fingerprint,
        req.strategy,
        float(req.initial_capital),
        req.start_date.isoformat(),
        end_iso,
        req.rebalance_frequency,
        int(req.minimum_holding_days),
        float(req.switching_threshold_pct),
        float(req.fee_bps_per_switch),
        float(req.drawdown_protection_pct),
        float(req.cash_reentry_score_pct),
        req.initialization_mode,
        bool(req.include_curves),
        bool(req.include_details),
    )

    def _compute() -> ProtectionCompareResponse:
        sliced = slice_prices(snapshot.prices, req.start_date, req.end_date)
        try:
            comp_df, curves_map, holdings_map, trades_map, diag_map = compare_protection_modes(
                sliced,
                strategy=req.strategy,
                initial_capital=float(req.initial_capital),
                start_date=req.start_date.isoformat(),
                end_date=end_iso,
                rebalance_frequency=req.rebalance_frequency,
                minimum_holding_days=int(req.minimum_holding_days),
                switching_threshold_pct=float(req.switching_threshold_pct),
                fee_bps_per_switch=float(req.fee_bps_per_switch),
                drawdown_protection_pct=float(req.drawdown_protection_pct),
                cash_reentry_score_pct=float(req.cash_reentry_score_pct),
                initialization_mode=req.initialization_mode,
            )
        except ValueError as exc:
            raise EngineValidationError(str(exc)) from exc

        comparison_rows: list[ProtectionCompareRow] = []
        for _, row in comp_df.iterrows():
            comparison_rows.append(
                ProtectionCompareRow(
                    experiment=str(row["Experiment"]),
                    strategy=str(row["Strategy"]),
                    rebalance=str(row["Rebalance"]) if pd.notna(row.get("Rebalance")) else None,
                    minimum_hold_days=(
                        int(row["Minimum hold (days)"])
                        if pd.notna(row.get("Minimum hold (days)"))
                        else None
                    ),
                    switch_threshold_pct=clean_float(row.get("Switch threshold (%)")),
                    fee_per_switch_bps=clean_float(row.get("Fee per switch (bps)")),
                    cash_enabled=(
                        clean_bool(row["Cash enabled"])
                        if pd.notna(row.get("Cash enabled"))
                        else None
                    ),
                    cash_filter=(
                        clean_bool(row["Cash filter"])
                        if pd.notna(row.get("Cash filter"))
                        else None
                    ),
                    drawdown_protection_pct=clean_float(row.get("Drawdown protection (%)")),
                    initialization_mode=(
                        str(row["Initialization mode"])
                        if pd.notna(row.get("Initialization mode"))
                        else None
                    ),
                    lifetime_max_drawdown_pct=clean_float(row.get("Lifetime max drawdown (%)")),
                    final_value_usd=clean_float(row.get("Final value (USD)")),
                    total_return_pct=clean_float(row.get("Total return (%)")),
                    cagr_pct=clean_float(row.get("CAGR (%)")),
                    maximum_drawdown_pct=clean_float(row.get("Maximum drawdown (%)")),
                    annualized_volatility_pct=clean_float(row.get("Annualized volatility (%)")),
                    sharpe_rf0=clean_float(row.get("Sharpe (rf=0)")),
                    switches=int(row["Switches"]),
                    cash_days=int(row["Cash days"]),
                )
            )

        curves_out: dict[str, list[BenchmarkPoint]] = {}
        if req.include_curves:
            for label, curve in curves_map.items():
                curves_out[label] = map_benchmark_curve(curve)

        holdings_out: dict[str, list[EquityPoint]] = {}
        trades_out: dict[str, list[ConstrainedTradeRow]] = {}
        diagnostics_out: dict[str, list[DiagnosticEventRow]] = {}
        if req.include_details:
            for mode_label in holdings_map:
                holdings_out[mode_label] = map_equity_and_holdings(
                    curves_map[mode_label], holdings_map[mode_label]
                )
                trades_out[mode_label] = map_trades_df(trades_map[mode_label])
                diagnostics_out[mode_label] = map_diagnostics_df(diag_map[mode_label])

        return ProtectionCompareResponse(
            configuration=req.model_copy(deep=True),
            date_range=build_date_range_info(sliced),
            comparison=comparison_rows,
            curves=curves_out,
            holdings_by_mode=holdings_out,
            trades_by_mode=trades_out,
            diagnostics_by_mode=diagnostics_out,
            assumptions_and_limitations=list(STANDARD_LIMITATIONS),
        )

    return response_cache.get_or_compute(key, _compute)


def run_practical_workflow(req: PracticalBacktestRequest) -> PracticalBacktestResponse:
    """Run practical no-lookahead Strategies A, B, and C via strategy_engine."""
    snapshot = get_dataset_snapshot()
    end_iso = req.end_date.isoformat() if req.end_date else None
    key = (
        "practical_strategies",
        snapshot.metadata.fingerprint,
        float(req.initial_capital),
        req.start_date.isoformat(),
        end_iso,
        float(req.fee_bps_per_switch),
    )

    def _compute() -> PracticalBacktestResponse:
        sliced = slice_prices(snapshot.prices, req.start_date, req.end_date)
        try:
            res = run_practical_strategies(
                sliced,
                initial_capital=float(req.initial_capital),
                start_date=req.start_date.isoformat(),
                end_date=end_iso,
                fee_bps_per_switch=float(req.fee_bps_per_switch),
            )
        except ValueError as exc:
            raise EngineValidationError(str(exc)) from exc

        summary_rows = [
            PracticalSummaryRow(
                strategy=str(row["Strategy"]),
                final_value_usd=clean_float(row.get("Final value (USD)")),
                total_return_pct=clean_float(row.get("Total return (%)")),
                cagr_pct=clean_float(row.get("CAGR (%)")),
                maximum_drawdown_pct=clean_float(row.get("Maximum drawdown (%)")),
                annualized_volatility_pct=clean_float(row.get("Annualized volatility (%)")),
                sharpe_rf0_daily=clean_float(row.get("Sharpe (rf=0, daily)")),
                switches=int(row["Switches"]),
            )
            for _, row in res.summary.iterrows()
        ]

        curves_out: dict[str, list[PracticalHoldingPoint]] = {}
        for name, curve in res.equity_curves.items():
            dd_pct = (curve / curve.cummax() - 1.0) * 100.0
            holdings_series = res.holdings.get(name)
            curves_out[name] = [
                PracticalHoldingPoint(
                    date=format_date(dt) or "",
                    value_usd=clean_float(val),
                    drawdown_pct=clean_float(dd_pct.get(dt)),
                    holding=(
                        str(holdings_series.get(dt))
                        if holdings_series is not None and pd.notna(holdings_series.get(dt))
                        else ("Bitcoin" if name == "Buy & hold: Bitcoin" else None)
                    ),
                )
                for dt, val in curve.items()
            ]

        trades_out: dict[str, list[PracticalTradeRow]] = {
            name: [
                PracticalTradeRow(
                    date=format_date(row["Date"]) or "",
                    from_asset=str(row["From"]),
                    to_asset=str(row["To"]),
                )
                for _, row in df.iterrows()
            ]
            for name, df in res.trades.items()
        }

        return PracticalBacktestResponse(
            configuration=req.model_copy(deep=True),
            date_range=build_date_range_info(sliced),
            summary=summary_rows,
            equity_curves=curves_out,
            trades=trades_out,
            assumptions_and_limitations=[
                "Signals computed at close t apply to close-to-close return t -> t+1 with zero lookahead.",
                "Always fully invested in one crypto asset (no cash filter or drawdown stop in practical baseline).",
                "Flat basis-point switch fees exclude slippage, bid/ask spreads, taxes, and liquidity impact.",
            ],
        )

    return response_cache.get_or_compute(key, _compute)


def run_hindsight_workflow(req: HindsightOptimizerRequest) -> HindsightOptimizerResponse:
    """Run perfect-hindsight dynamic programming optimizer (explicit non-investable upper bound)."""
    snapshot = get_dataset_snapshot()
    end_iso = req.end_date.isoformat() if req.end_date else None
    key = (
        "hindsight_optimizer",
        snapshot.metadata.fingerprint,
        float(req.initial_capital),
        req.start_date.isoformat(),
        end_iso,
        int(req.max_switches),
    )

    def _compute() -> HindsightOptimizerResponse:
        sliced = slice_prices(snapshot.prices, req.start_date, req.end_date)
        try:
            res = optimal_switching(
                sliced,
                initial_capital=float(req.initial_capital),
                max_switches=int(req.max_switches),
                start_date=req.start_date.isoformat(),
            )
        except ValueError as exc:
            raise EngineValidationError(str(exc)) from exc

        summary_rows: list[HindsightSummaryRow] = []
        for _, row in res.summary.iterrows():
            cap = int(row["Maximum switches"])
            curve = res.equity_curves.get(cap)
            mdd = clean_float(max_drawdown(curve)) if curve is not None else None
            summary_rows.append(
                HindsightSummaryRow(
                    maximum_switches=cap,
                    actual_switches=int(row["Actual switches"]),
                    final_value_usd=float(row["Final value (USD)"]),
                    profit_usd=float(row["Profit (USD)"]),
                    return_pct=float(row["Return (%)"]),
                    ending_asset=str(row["Ending asset"]),
                    maximum_drawdown_pct=mdd,
                )
            )

        paths_out = {
            str(cap): [
                HindsightSwitchEvent(date=format_date(dt) or "", switch_into=str(asset))
                for dt, asset in switches
            ]
            for cap, switches in res.paths.items()
        }
        curves_out = {
            str(cap): map_benchmark_curve(curve)
            for cap, curve in res.equity_curves.items()
        }

        return HindsightOptimizerResponse(
            warning=HINDSIGHT_WARNING,
            configuration=req.model_copy(deep=True),
            date_range=build_date_range_info(sliced),
            summary=summary_rows,
            paths=paths_out,
            equity_curves=curves_out,
        )

    return response_cache.get_or_compute(key, _compute)

