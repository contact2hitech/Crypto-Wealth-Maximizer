"""Shared mapping utilities translating engine DataFrames/Series into Pydantic schemas."""

from __future__ import annotations

from typing import Any

import pandas as pd

from backend.core.serialization import clean_bool, clean_float, clean_int, format_date
from backend.schemas.backtests import (
    BenchmarkPoint,
    ConstrainedSummaryRow,
    ConstrainedTradeRow,
    DiagnosticEventRow,
    DrawdownTraceRow,
    EquityPoint,
)
from backend.schemas.common import DateRangeInfo
from backend.schemas.markets import DailyAssetPoint
from backend.schemas.risk import DrawdownExitEvent, EventCountSummary, ExitMetricsSummary
from robustness_engine import protection_effectiveness

MARKET_CAVEATS: list[str] = [
    "Solana historical data begins on 2020-04-10; 1,248 earlier observations remain null and are never forward-filled or fabricated.",
    "Ethereum history prior to 2017-11-09 in the bundled CSV reflects a reconciled series noted as provisional in DATA_SOURCES.md.",
    "Daily closing prices are research inputs and do not model intraday fills, bid/ask spreads, or exchange liquidity.",
]

STANDARD_LIMITATIONS: list[str] = [
    "Research software only: historical simulated results are hypothetical and not investment advice or a forecast of future returns.",
    "Daily-close drawdown protection is not an intraday stop-loss and cannot guarantee a maximum loss equal to its trigger threshold.",
    "Simplified flat basis-point fees exclude spreads, slippage, taxes, market impact, custody risk, and exchange downtime.",
    "Walk-forward periods start with fresh initial capital and are independent period tests, not a continuous funded account.",
    "The reviewed held-out Test period (2025-01-01 to 2026-11-09) produced negative returns and negative Sharpe for the reference configuration.",
]


def build_date_range_info(df: pd.DataFrame) -> DateRangeInfo:
    """Create DateRangeInfo from a DataFrame indexed by DatetimeIndex."""
    return DateRangeInfo(
        start_date=format_date(df.index.min()) or "",
        end_date=format_date(df.index.max()) or "",
        row_count=int(len(df)),
    )


def frame_to_asset_points(df: pd.DataFrame) -> list[DailyAssetPoint]:
    """Convert a BTC/ETH/SOL DataFrame into JSON-safe DailyAssetPoint rows."""
    points: list[DailyAssetPoint] = []
    for dt, row in df.iterrows():
        points.append(
            DailyAssetPoint(
                date=format_date(dt) or "",
                Bitcoin=clean_float(row.get("Bitcoin")),
                Ethereum=clean_float(row.get("Ethereum")),
                Solana=clean_float(row.get("Solana")),
            )
        )
    return points


def map_constrained_summary(row: dict[str, Any]) -> ConstrainedSummaryRow:
    """Map one summary row dictionary from optimization_engine into ConstrainedSummaryRow."""
    return ConstrainedSummaryRow(
        strategy=str(row["Strategy"]),
        rebalance=str(row["Rebalance"]),
        minimum_hold_days=int(row["Minimum hold (days)"]),
        switch_threshold_pct=float(row["Switch threshold (%)"]),
        fee_per_switch_bps=float(row["Fee per switch (bps)"]),
        cash_enabled=clean_bool(row["Cash enabled"]),
        cash_filter=clean_bool(row["Cash filter"]),
        drawdown_protection_pct=float(row["Drawdown protection (%)"]),
        initialization_mode=str(row["Initialization mode"]),
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


def map_equity_and_holdings(equity: pd.Series, holdings: pd.Series) -> list[EquityPoint]:
    """Combine equity curve, underwater drawdown (%), and holdings series."""
    drawdown_pct = (equity / equity.cummax() - 1.0) * 100.0
    aligned_holdings = holdings.reindex(equity.index)
    points: list[EquityPoint] = []
    for dt, val in equity.items():
        points.append(
            EquityPoint(
                date=format_date(dt) or "",
                value_usd=clean_float(val),
                drawdown_pct=clean_float(drawdown_pct.get(dt)),
                holding=str(aligned_holdings.get(dt, "")),
            )
        )
    return points


def map_benchmark_curve(equity: pd.Series) -> list[BenchmarkPoint]:
    """Convert an equity curve Series to daily BenchmarkPoint items with drawdown (%)."""
    drawdown_pct = (equity / equity.cummax() - 1.0) * 100.0
    return [
        BenchmarkPoint(
            date=format_date(dt) or "",
            value_usd=clean_float(val),
            drawdown_pct=clean_float(drawdown_pct.get(dt)),
        )
        for dt, val in equity.items()
    ]


def map_trades_df(trades_df: pd.DataFrame) -> list[ConstrainedTradeRow]:
    """Map trades DataFrame from optimization_engine to ConstrainedTradeRow list."""
    rows: list[ConstrainedTradeRow] = []
    for _, row in trades_df.iterrows():
        best_asset = row.get("Best asset")
        reason = row.get("Reason")
        rows.append(
            ConstrainedTradeRow(
                signal_date=format_date(row["Signal date"]) or "",
                signal_execution_date=format_date(row["Signal / execution date"]) or "",
                from_asset=str(row["From"]),
                to_asset=str(row["To"]),
                reason=str(reason) if pd.notna(reason) else None,
                portfolio_value_after_fee_usd=clean_float(row.get("Portfolio value after fee (USD)")),
                peak_before_decision_usd=clean_float(row.get("Peak before decision (USD)")),
                drawdown_at_decision_pct=clean_float(row.get("Drawdown at decision (%)")),
                best_asset=str(best_asset) if pd.notna(best_asset) else None,
                best_score_pct=clean_float(row.get("Best score (%)")),
            )
        )
    return rows


def map_diagnostics_df(diag_df: pd.DataFrame) -> list[DiagnosticEventRow]:
    """Map diagnostics DataFrame from optimization_engine to DiagnosticEventRow list."""
    rows: list[DiagnosticEventRow] = []
    for _, row in diag_df.iterrows():
        best_asset = row.get("Best asset")
        event = row.get("Event")
        rows.append(
            DiagnosticEventRow(
                date=format_date(row["Date"]) or "",
                event=str(event) if pd.notna(event) else None,
                from_asset=str(row["From"]),
                to_asset=str(row["To"]),
                portfolio_value_usd=clean_float(row.get("Portfolio value (USD)")),
                peak_portfolio_value_usd=clean_float(row.get("Peak portfolio value (USD)")),
                drawdown_pct=clean_float(row.get("Drawdown (%)")),
                best_asset=str(best_asset) if pd.notna(best_asset) else None,
                best_score_pct=clean_float(row.get("Best score (%)")),
                scheduled_rebalance=clean_bool(row.get("Scheduled rebalance", False)),
            )
        )
    return rows


def map_trace_df(trace_df: pd.DataFrame) -> list[DrawdownTraceRow]:
    """Map 17-column daily drawdown trace DataFrame into DrawdownTraceRow list."""
    rows: list[DrawdownTraceRow] = []
    for _, row in trace_df.iterrows():
        rows.append(
            DrawdownTraceRow(
                date=format_date(row["Date"]) or "",
                holding_during_interval=str(row["Holding during close-to-close interval"]),
                holding_before_decision=str(row["Holding before decision"]),
                previous_close_portfolio_value_usd=clean_float(row.get("Previous close portfolio value (USD)")),
                portfolio_value_before_decision_usd=clean_float(row.get("Portfolio value before decision (USD)")),
                previous_high_water_mark_usd=clean_float(row.get("Previous high-water mark (USD)")),
                high_water_mark_before_decision_usd=clean_float(row.get("High-water mark before decision (USD)")),
                high_water_mark_updated_today=clean_bool(row["High-water mark updated today"]),
                close_to_close_portfolio_return_pct=clean_float(row.get("Close-to-close portfolio return (%)")),
                drawdown_before_decision_pct=clean_float(row.get("Drawdown before decision (%)")),
                protection_threshold_pct=clean_float(row.get("Protection threshold (%)")),
                drawdown_trigger_breached=clean_bool(row["Drawdown trigger breached"]),
                scheduled_rebalance=clean_bool(row["Scheduled rebalance"]),
                decision=str(row["Decision"]),
                holding_after_decision=str(row["Holding after decision"]),
                execution_assumption=str(row["Execution assumption"]),
                fee_rate_bps=float(row["Fee rate (bps)"]),
            )
        )
    return rows


def compute_protection_summaries(
    diagnostics_df: pd.DataFrame,
    trigger_pct: float,
) -> tuple[list[EventCountSummary], list[DrawdownExitEvent], ExitMetricsSummary]:
    """Compute event summary, drawdown exit rows, and aggregate exit stats via robustness_engine."""
    counts_df, exits_df = protection_effectiveness(diagnostics_df, float(trigger_pct))

    event_summary: list[EventCountSummary] = []
    for _, row in counts_df.iterrows():
        event_summary.append(
            EventCountSummary(
                event=str(row["Event"]),
                events=clean_int(row["Events"]) or 0,
                mean_drawdown_pct=clean_float(row.get("Mean_drawdown_pct")),
                worst_drawdown_pct=clean_float(row.get("Worst_drawdown_pct")),
                median_drawdown_pct=clean_float(row.get("Median_drawdown_pct")),
            )
        )

    drawdown_exits: list[DrawdownExitEvent] = []
    for _, row in exits_df.iterrows():
        best_asset = row.get("Best asset")
        drawdown_exits.append(
            DrawdownExitEvent(
                date=format_date(row["Date"]) or "",
                event=str(row["Event"]),
                from_asset=str(row["From"]),
                to_asset=str(row["To"]),
                portfolio_value_usd=clean_float(row.get("Portfolio value (USD)")),
                peak_portfolio_value_usd=clean_float(row.get("Peak portfolio value (USD)")),
                drawdown_pct=clean_float(row.get("Drawdown (%)")),
                best_asset=str(best_asset) if pd.notna(best_asset) else None,
                best_score_pct=clean_float(row.get("Best score (%)")),
                scheduled_rebalance=clean_bool(row.get("Scheduled rebalance", False)),
                overshoot_beyond_configured_trigger_pp=clean_float(
                    row.get("Overshoot beyond configured trigger (pp)")
                ),
            )
        )

    if exits_df.empty:
        exit_metrics = ExitMetricsSummary(total_drawdown_exits=0)
    else:
        dd_series = exits_df["Drawdown (%)"].dropna()
        overshoot_series = exits_df["Overshoot beyond configured trigger (pp)"].dropna()
        worst_idx = dd_series.idxmin() if not dd_series.empty else None
        worst_date = (
            format_date(exits_df.loc[worst_idx, "Date"])
            if worst_idx is not None
            else None
        )
        exit_metrics = ExitMetricsSummary(
            total_drawdown_exits=int(len(exits_df)),
            average_exit_drawdown_pct=clean_float(dd_series.mean()) if not dd_series.empty else None,
            median_exit_drawdown_pct=clean_float(dd_series.median()) if not dd_series.empty else None,
            worst_exit_drawdown_pct=clean_float(dd_series.min()) if not dd_series.empty else None,
            worst_exit_date=worst_date,
            average_overshoot_pp=clean_float(overshoot_series.mean()) if not overshoot_series.empty else None,
            max_overshoot_pp=clean_float(overshoot_series.max()) if not overshoot_series.empty else None,
        )

    return event_summary, drawdown_exits, exit_metrics

