"""Market data, health status, normalized comparisons, crossovers, and data quality service."""

from __future__ import annotations

import datetime
import platform
from typing import Optional

from backend.core.config import get_settings
from backend.core.data_loader import (
    compute_asset_quality,
    get_dataset_snapshot,
    slice_prices,
)
from backend.core.serialization import clean_float, format_date
from backend.schemas.health import DatasetHealthInfo, HealthResponse
from backend.schemas.markets import (
    AssetQualityRow,
    BuyAndHoldRow,
    CrossoverRow,
    LatestCloseSnapshot,
    MarketPricesResponse,
    MarketSummaryResponse,
)
from backend.services.cache import response_cache
from backend.services.common import (
    MARKET_CAVEATS,
    build_date_range_info,
    frame_to_asset_points,
)
from crypto_engine import (
    ASSETS,
    buy_and_hold,
    common_start_indices,
    find_crossovers,
    normalized_indices,
)


def get_health_status() -> HealthResponse:
    """Return service readiness and canonical dataset audit status."""
    settings = get_settings()
    snapshot = get_dataset_snapshot()
    meta = snapshot.metadata
    return HealthResponse(
        status="ok" if meta.is_valid else "degraded",
        service=settings.app_name,
        version=settings.app_version,
        app_env=settings.app_env,
        engine_source_of_truth="python",
        python_version=platform.python_version(),
        timestamp_utc=datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        dataset=DatasetHealthInfo(
            path_relative=meta.path_relative,
            row_count=meta.row_count,
            duplicate_dates=meta.duplicate_dates,
            start_date=meta.start_date,
            end_date=meta.end_date,
            assets_available=list(meta.assets_available),
            missing_pre_launch_sol_days=meta.missing_pre_launch_sol_days,
            last_modified_utc=meta.last_modified_utc,
            valid=meta.is_valid,
        ),
    )


def get_market_prices(
    start_date: Optional[datetime.date] = None,
    end_date: Optional[datetime.date] = None,
    initial_capital: float = 1480.0,
) -> MarketPricesResponse:
    """Return historical closes, normalized/common-start indices, crossovers, and buy-and-hold."""
    snapshot = get_dataset_snapshot()
    key = (
        "markets_prices",
        snapshot.metadata.fingerprint,
        start_date.isoformat() if start_date else None,
        end_date.isoformat() if end_date else None,
        float(initial_capital),
    )

    def _compute() -> MarketPricesResponse:
        sliced = slice_prices(snapshot.prices, start_date, end_date)
        norm_df = normalized_indices(sliced)
        common_df = common_start_indices(sliced)
        valid_common = sliced.dropna(subset=list(ASSETS))
        common_start_dt = format_date(valid_common.index.min()) if not valid_common.empty else None

        cross_df = find_crossovers(sliced)
        cross_rows = [
            CrossoverRow(
                date=format_date(row["Date"]) or "",
                pair=str(row["Pair"]),
                leader_after_crossover=str(row["Leader after crossover"]),
                index_spread_after_crossover=float(row["Index spread after crossover"]),
            )
            for _, row in cross_df.iterrows()
        ]

        effective_start = format_date(sliced.index.min()) or snapshot.metadata.start_date
        bh_df = buy_and_hold(sliced, initial_capital=float(initial_capital), start_date=effective_start)
        bh_rows = [
            BuyAndHoldRow(
                asset=str(row["Asset"]),
                entry_date=format_date(row["Entry date"]) or "",
                last_price_date=format_date(row["Last price date"]) or "",
                final_value_usd=float(row["Final value (USD)"]),
                profit_usd=float(row["Profit (USD)"]),
                return_pct=float(row["Return (%)"]),
            )
            for _, row in bh_df.iterrows()
        ]

        return MarketPricesResponse(
            date_range=build_date_range_info(sliced),
            initial_capital=float(initial_capital),
            common_start_date=common_start_dt,
            prices=frame_to_asset_points(sliced),
            normalized_indices=frame_to_asset_points(norm_df),
            common_start_indices=frame_to_asset_points(common_df),
            crossovers=cross_rows,
            buy_and_hold=bh_rows,
            caveats=list(MARKET_CAVEATS),
        )

    return response_cache.get_or_compute(key, _compute)


def get_market_summary(
    start_date: Optional[datetime.date] = None,
    end_date: Optional[datetime.date] = None,
) -> MarketSummaryResponse:
    """Return latest closing prices and per-asset data quality status."""
    snapshot = get_dataset_snapshot()
    key = (
        "markets_summary",
        snapshot.metadata.fingerprint,
        start_date.isoformat() if start_date else None,
        end_date.isoformat() if end_date else None,
    )

    def _compute() -> MarketSummaryResponse:
        sliced = slice_prices(snapshot.prices, start_date, end_date)
        non_empty = sliced.dropna(how="all")
        latest_idx = non_empty.index[-1]
        latest_row = non_empty.iloc[-1]

        # When evaluating full date range, include raw pre-clean non-positive check counts.
        raw_non_pos = (
            snapshot.raw_non_positive_counts
            if start_date is None and end_date is None
            else None
        )
        quality_items = [
            AssetQualityRow(**item)
            for item in compute_asset_quality(sliced, raw_non_positive_counts=raw_non_pos)
        ]
        all_clean = (
            snapshot.metadata.duplicate_dates == 0
            and all(item.non_positive_prices == 0 for item in quality_items)
        )

        return MarketSummaryResponse(
            date_range=build_date_range_info(sliced),
            duplicate_dates=snapshot.metadata.duplicate_dates,
            data_quality_status="valid" if all_clean else "warning",
            latest_closes=LatestCloseSnapshot(
                as_of_date=format_date(latest_idx) or "",
                Bitcoin=clean_float(latest_row.get("Bitcoin")),
                Ethereum=clean_float(latest_row.get("Ethereum")),
                Solana=clean_float(latest_row.get("Solana")),
            ),
            asset_quality=quality_items,
            caveats=list(MARKET_CAVEATS),
        )

    return response_cache.get_or_compute(key, _compute)

