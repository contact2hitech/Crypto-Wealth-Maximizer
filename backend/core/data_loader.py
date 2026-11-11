"""Project-root-relative canonical CSV loader and data quality validator."""

from __future__ import annotations

import datetime
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Optional

import pandas as pd

from backend.core.config import get_settings
from backend.core.exceptions import DataUnavailableError, InvalidDateRangeError
from backend.core.serialization import format_date
from crypto_engine import ASSETS, clean_prices

EXPECTED_PRICE_COLUMNS = tuple(ASSETS.keys())


@dataclass(frozen=True)
class DatasetMetadata:
    """Immutable metadata describing the loaded canonical historical dataset."""

    path_relative: str
    fingerprint: str
    row_count: int
    duplicate_dates: int
    start_date: str
    end_date: str
    assets_available: tuple[str, ...]
    missing_pre_launch_sol_days: int
    last_modified_utc: str
    is_valid: bool


@dataclass(frozen=True)
class DatasetSnapshot:
    """Safe dataset payload containing a defensive copy of prices and immutable metadata."""

    prices: pd.DataFrame
    metadata: DatasetMetadata
    raw_non_positive_counts: dict[str, int]


def compute_asset_quality(
    prices: pd.DataFrame,
    raw_non_positive_counts: Optional[dict[str, int]] = None,
) -> list[dict[str, Any]]:
    """Compute per-asset availability, missingness, and >50% daily-move review counts."""
    quality_rows: list[dict[str, Any]] = []
    for asset in EXPECTED_PRICE_COLUMNS:
        series = prices[asset] if asset in prices.columns else pd.Series(dtype=float)
        valid = series.dropna()
        daily_returns = valid.pct_change().dropna()
        outliers = daily_returns[daily_returns.abs() > 0.50]
        non_pos = (
            raw_non_positive_counts.get(asset, 0)
            if raw_non_positive_counts is not None
            else int((series.dropna() <= 0).sum())
        )
        quality_rows.append(
            {
                "asset": asset,
                "ticker": ASSETS[asset],
                "first_available_date": format_date(valid.index.min()) if not valid.empty else None,
                "last_available_date": format_date(valid.index.max()) if not valid.empty else None,
                "valid_observations": int(valid.size),
                "missing_observations": int(series.isna().sum()),
                "non_positive_prices": int(non_pos),
                "outliers_over_50pct": int(len(outliers)),
            }
        )
    return quality_rows


@lru_cache(maxsize=4)
def _load_cached_bundle(
    resolved_path_str: str,
    mtime_ns: int,
    size_bytes: int,
    repo_root_str: str,
) -> tuple[pd.DataFrame, DatasetMetadata, dict[str, int]]:
    path = Path(resolved_path_str)
    repo_root = Path(repo_root_str)
    try:
        raw = pd.read_csv(path)
    except Exception as exc:
        raise DataUnavailableError(
            "Unable to read historical price dataset CSV.",
            details={"path": path.name},
        ) from exc

    if raw.empty:
        raise DataUnavailableError("Historical price dataset CSV contains no rows.")

    date_col = "Date" if "Date" in raw.columns else raw.columns[0]
    try:
        raw[date_col] = pd.to_datetime(raw[date_col])
    except Exception as exc:
        raise DataUnavailableError("Historical price dataset has unparseable dates.") from exc

    duplicate_dates = int(raw[date_col].duplicated().sum())
    indexed = raw.set_index(date_col)
    indexed.index.name = "Date"
    indexed = indexed.rename(columns={"BTC-USD": "Bitcoin", "ETH-USD": "Ethereum", "SOL-USD": "Solana"})

    raw_non_positive: dict[str, int] = {}
    for asset in EXPECTED_PRICE_COLUMNS:
        if asset in indexed.columns:
            numeric_col = pd.to_numeric(indexed[asset], errors="coerce")
            raw_non_positive[asset] = int((numeric_col.dropna() <= 0).sum())
        else:
            raw_non_positive[asset] = 0

    cleaned = clean_prices(indexed).dropna(how="all")
    if cleaned.empty or cleaned["Bitcoin"].dropna().empty:
        raise DataUnavailableError(
            "Canonical dataset does not contain valid Bitcoin observations after cleaning."
        )

    try:
        path_relative = path.relative_to(repo_root).as_posix()
    except ValueError:
        path_relative = path.name

    sol_series = cleaned["Solana"]
    sol_first_valid = sol_series.first_valid_index()
    if sol_first_valid is not None:
        pre_launch_missing = int(sol_series.loc[sol_series.index < sol_first_valid].isna().sum())
    else:
        pre_launch_missing = int(sol_series.isna().sum())

    assets_available = tuple(
        asset for asset in EXPECTED_PRICE_COLUMNS if not cleaned[asset].dropna().empty
    )
    last_modified_utc = datetime.datetime.fromtimestamp(
        mtime_ns / 1_000_000_000, tz=datetime.timezone.utc
    ).strftime("%Y-%m-%dT%H:%M:%SZ")
    fingerprint = f"{resolved_path_str}:{mtime_ns}:{size_bytes}"

    metadata = DatasetMetadata(
        path_relative=path_relative,
        fingerprint=fingerprint,
        row_count=int(len(cleaned)),
        duplicate_dates=duplicate_dates,
        start_date=format_date(cleaned.index.min()) or "",
        end_date=format_date(cleaned.index.max()) or "",
        assets_available=assets_available,
        missing_pre_launch_sol_days=pre_launch_missing,
        last_modified_utc=last_modified_utc,
        is_valid=(duplicate_dates == 0 and all(v == 0 for v in raw_non_positive.values())),
    )
    return cleaned, metadata, raw_non_positive


def get_dataset_snapshot() -> DatasetSnapshot:
    """Return a defensive copy of the canonical prices DataFrame and immutable metadata."""
    settings = get_settings()
    data_path = settings.data_file_path
    if not data_path.exists() or not data_path.is_file():
        raise DataUnavailableError(
            "Canonical historical price dataset file was not found.",
            details={"expected_relative_path": "data/crypto_daily_prices.csv"},
        )

    stat = data_path.stat()
    cleaned, metadata, raw_non_positive = _load_cached_bundle(
        str(data_path.resolve()),
        stat.st_mtime_ns,
        stat.st_size,
        str(settings.repo_root.resolve()),
    )
    return DatasetSnapshot(
        prices=cleaned.copy(deep=True),
        metadata=metadata,
        raw_non_positive_counts=dict(raw_non_positive),
    )


def slice_prices(
    prices: pd.DataFrame,
    start_date: Optional[datetime.date] = None,
    end_date: Optional[datetime.date] = None,
) -> pd.DataFrame:
    """Slice a defensive price copy to [start_date, end_date] matching app.py filtering."""
    if start_date is not None and end_date is not None and start_date > end_date:
        raise InvalidDateRangeError(
            "start_date must be on or before end_date.",
            details={"start_date": start_date.isoformat(), "end_date": end_date.isoformat()},
        )

    sliced = prices
    if start_date is not None:
        sliced = sliced.loc[sliced.index >= pd.Timestamp(start_date)]
    if end_date is not None:
        sliced = sliced.loc[sliced.index <= pd.Timestamp(end_date)]
    sliced = sliced.copy()
    if sliced.empty:
        raise InvalidDateRangeError(
            "No historical observations exist in the selected date range.",
            details={
                "start_date": start_date.isoformat() if start_date else None,
                "end_date": end_date.isoformat() if end_date else None,
            },
        )
    return sliced

