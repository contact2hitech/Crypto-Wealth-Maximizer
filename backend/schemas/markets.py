"""Schemas for /api/markets/prices and /api/markets/summary endpoints."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel

from backend.schemas.common import DateRangeInfo


class DailyAssetPoint(BaseModel):
    """Daily BTC, ETH, and SOL values; pre-launch SOL remains null."""

    date: str
    Bitcoin: Optional[float] = None
    Ethereum: Optional[float] = None
    Solana: Optional[float] = None


class CrossoverRow(BaseModel):
    """Relative-performance index crossover record from crypto_engine.find_crossovers."""

    date: str
    pair: str
    leader_after_crossover: str
    index_spread_after_crossover: float


class BuyAndHoldRow(BaseModel):
    """Buy-and-hold summary row from crypto_engine.buy_and_hold."""

    asset: str
    entry_date: str
    last_price_date: str
    final_value_usd: float
    profit_usd: float
    return_pct: float


class MarketPricesResponse(BaseModel):
    """Historical closes, normalized indices, common-start indices, crossovers, and benchmarks."""

    date_range: DateRangeInfo
    initial_capital: float
    common_start_date: Optional[str] = None
    prices: list[DailyAssetPoint]
    normalized_indices: list[DailyAssetPoint]
    common_start_indices: list[DailyAssetPoint]
    crossovers: list[CrossoverRow]
    buy_and_hold: list[BuyAndHoldRow]
    caveats: list[str]


class LatestCloseSnapshot(BaseModel):
    """Latest non-empty closing prices in the selected range."""

    as_of_date: str
    Bitcoin: Optional[float] = None
    Ethereum: Optional[float] = None
    Solana: Optional[float] = None


class AssetQualityRow(BaseModel):
    """Per-asset data availability and integrity metrics."""

    asset: str
    ticker: str
    first_available_date: Optional[str] = None
    last_available_date: Optional[str] = None
    valid_observations: int
    missing_observations: int
    non_positive_prices: int
    outliers_over_50pct: int


class MarketSummaryResponse(BaseModel):
    """Data quality audit and latest market summary."""

    date_range: DateRangeInfo
    duplicate_dates: int
    data_quality_status: Literal["valid", "warning"]
    latest_closes: LatestCloseSnapshot
    asset_quality: list[AssetQualityRow]
    caveats: list[str]

