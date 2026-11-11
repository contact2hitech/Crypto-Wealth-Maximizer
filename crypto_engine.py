from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

ASSETS = {"Bitcoin": "BTC-USD", "Ethereum": "ETH-USD", "Solana": "SOL-USD"}
START_DATE = "2016-11-09"
# yfinance end dates are exclusive; this includes data through 2026-11-09.
END_DATE = "2026-11-10"
DATA_DIR = Path("data")
PRICE_FILE = DATA_DIR / "crypto_daily_prices.csv"


def download_prices(start: str = START_DATE, end: str = END_DATE,
                    force: bool = False) -> pd.DataFrame:
    """Download daily USD closes from Yahoo Finance via yfinance and cache a tidy CSV."""
    DATA_DIR.mkdir(exist_ok=True)
    if PRICE_FILE.exists() and not force:
        cached = pd.read_csv(PRICE_FILE, parse_dates=["Date"]).set_index("Date")
        return cached.sort_index()

    try:
        import yfinance as yf
    except ImportError as exc:
        raise RuntimeError("Install dependencies first: pip install -r requirements.txt") from exc

    raw = yf.download(
        list(ASSETS.values()),
        start=start,
        end=end,
        interval="1d",
        auto_adjust=False,
        progress=False,
        group_by="column",
        threads=True,
    )
    if raw.empty:
        raise RuntimeError(
            "Yahoo Finance returned no rows. Check your internet connection, "
            "or place a CSV named data/crypto_daily_prices.csv in the expected format."
        )

    # yfinance may return either MultiIndex or flat columns depending on version.
    if isinstance(raw.columns, pd.MultiIndex):
        level0 = raw.columns.get_level_values(0)
        if "Close" in level0:
            close = raw["Close"].copy()
        else:
            close = raw.xs("Close", axis=1, level=1).copy()
    else:
        close = raw[["Close"]].copy()
        if len(ASSETS) == 1:
            close.columns = list(ASSETS.values())

    close = close.rename(columns={ticker: name for name, ticker in ASSETS.items()})
    for name in ASSETS:
        if name not in close.columns:
            close[name] = np.nan
    close = close[list(ASSETS)].apply(pd.to_numeric, errors="coerce")
    close.index = pd.to_datetime(close.index).tz_localize(None).normalize()
    close.index.name = "Date"
    close = close[~close.index.duplicated(keep="last")].sort_index()
    close.to_csv(PRICE_FILE)
    return close


def load_prices(uploaded_file=None, force_download: bool = False) -> pd.DataFrame:
    if uploaded_file is not None:
        df = pd.read_csv(uploaded_file)
        date_col = "Date" if "Date" in df.columns else df.columns[0]
        df[date_col] = pd.to_datetime(df[date_col])
        df = df.set_index(date_col)
        df.index.name = "Date"
        df = df.rename(columns={"BTC-USD": "Bitcoin", "ETH-USD": "Ethereum", "SOL-USD": "Solana"})
        for name in ASSETS:
            if name not in df.columns:
                df[name] = np.nan
        return df[list(ASSETS)].apply(pd.to_numeric, errors="coerce").sort_index()
    return download_prices(force=force_download)


def clean_prices(prices: pd.DataFrame) -> pd.DataFrame:
    out = prices.copy()
    out.index = pd.to_datetime(out.index).tz_localize(None).normalize()
    out = out[~out.index.duplicated(keep="last")].sort_index()
    for col in ASSETS:
        if col not in out:
            out[col] = np.nan
    out = out[list(ASSETS)].apply(pd.to_numeric, errors="coerce")
    out = out.where(out > 0)
    return out


def normalized_indices(prices: pd.DataFrame) -> pd.DataFrame:
    """Each asset starts at 100 on its own first valid date; useful for full-history context."""
    p = clean_prices(prices)
    result = pd.DataFrame(index=p.index)
    for col in p:
        valid = p[col].dropna()
        result[col] = p[col] / valid.iloc[0] * 100 if not valid.empty else np.nan
    return result


def common_start_indices(prices: pd.DataFrame) -> pd.DataFrame:
    """Normalize all three assets to 100 on the first date when all three have prices."""
    p = clean_prices(prices)
    valid = p.dropna(subset=list(ASSETS)).copy()
    if valid.empty:
        return pd.DataFrame(index=p.index, columns=list(ASSETS), dtype=float)
    first = valid.iloc[0]
    return p / first * 100


def find_crossovers(prices: pd.DataFrame) -> pd.DataFrame:
    """Find daily close crossovers of normalized relative-performance indices."""
    idx = common_start_indices(prices)
    rows = []
    names = list(ASSETS)
    for a_i in range(len(names)):
        for b_i in range(a_i + 1, len(names)):
            a, b = names[a_i], names[b_i]
            spread = (idx[a] - idx[b]).dropna()
            sign = np.sign(spread)
            changed = sign.ne(sign.shift(1)) & sign.shift(1).notna() & sign.ne(0)
            for dt in spread.index[changed]:
                rows.append({
                    "Date": dt,
                    "Pair": f"{a} / {b}",
                    "Leader after crossover": a if spread.loc[dt] > 0 else b,
                    "Index spread after crossover": float(spread.loc[dt]),
                })
    return pd.DataFrame(rows).sort_values("Date") if rows else pd.DataFrame(
        columns=["Date", "Pair", "Leader after crossover", "Index spread after crossover"]
    )


@dataclass
class StrategyResult:
    summary: pd.DataFrame
    paths: dict[int, list[tuple[pd.Timestamp, str]]]
    equity_curves: dict[int, pd.Series]


def optimal_switching(prices: pd.DataFrame, initial_capital: float = 1480.0,
                      max_switches: int = 5, start_date: str = START_DATE
                      ) -> StrategyResult:
    """
    Perfect-hindsight dynamic programming.
    Start 100% in Bitcoin on start_date. At each daily close, hold or switch 100%
    into another asset with an available close. No fees, taxes or slippage.
    A switch is counted when the held asset changes.
    """
    p = clean_prices(prices)
    p = p.loc[p.index >= pd.Timestamp(start_date)].copy()
    p = p.dropna(how="all")
    if p.empty or p["Bitcoin"].dropna().empty:
        raise ValueError("No Bitcoin prices are available on or after the selected start date.")
    p = p.loc[p.index >= p["Bitcoin"].first_valid_index()]
    dates = list(p.index)
    assets = list(ASSETS)
    n, m = len(dates), len(assets)
    if n < 2:
        raise ValueError("Not enough daily observations to run the simulation.")

    # dp[k][j] = best portfolio value at today's close, ending in asset j,
    # with exactly k switches. Keep predecessor pointers for reconstruction.
    K = max_switches
    prev = np.full((K + 1, m), -np.inf)
    prev[0, assets.index("Bitcoin")] = initial_capital
    back = {}
    # Initial state is the first valid BTC date, invested entirely in BTC.

    for t in range(1, n):
        today = p.iloc[t].to_numpy(dtype=float)
        yesterday = p.iloc[t - 1].to_numpy(dtype=float)
        # First accrue the return of the asset held from yesterday to today.
        grown = np.full((K + 1, m), -np.inf)
        for j in range(m):
            if np.isfinite(today[j]) and np.isfinite(yesterday[j]) and yesterday[j] > 0:
                grown[:, j] = prev[:, j] * (today[j] / yesterday[j])

        # At today's close, the portfolio may remain in its current asset or switch.
        curr = np.full((K + 1, m), -np.inf)
        for k in range(K + 1):
            for j in range(m):
                if not np.isfinite(today[j]):
                    continue
                best_val, best_i, best_k = -np.inf, None, None
                for i in range(m):
                    if i == j:
                        candidate_k = k
                        candidate = grown[candidate_k, i]
                    else:
                        candidate_k = k - 1
                        candidate = grown[candidate_k, i] if candidate_k >= 0 else -np.inf
                    if candidate > best_val:
                        best_val, best_i, best_k = candidate, i, candidate_k
                curr[k, j] = best_val
                if best_i is not None and np.isfinite(best_val):
                    back[(t, k, j)] = (best_k, best_i)
        prev = curr

    # Choose best result for each switch cap (at most k switches).
    summaries, paths, equity = [], {}, {}
    for cap in range(K + 1):
        candidates = [(prev[k, j], k, j) for k in range(cap + 1) for j in range(m)]
        value, used_k, end_j = max(candidates, key=lambda x: x[0])
        if not np.isfinite(value):
            continue
        # Reconstruct state path, then compress consecutive same-asset positions.
        state_path = []
        t, k, j = n - 1, used_k, end_j
        state_path.append((dates[t], assets[j]))
        while t > 0:
            key = (t, k, j)
            if key not in back:
                break
            prev_k, prev_j = back[key]
            t, k, j = t - 1, prev_k, prev_j
            state_path.append((dates[t], assets[j]))
        state_path.reverse()
        switches = []
        last_asset = state_path[0][1]
        for dt, asset in state_path[1:]:
            if asset != last_asset:
                switches.append((dt, asset))
                last_asset = asset
        paths[cap] = switches
        # Rebuild the equity curve from the actual reconstructed holdings path.
        # Do not take the daily maximum across assets: that would create an
        # impossible curve that silently changes assets without counting switches.
        portfolio_values = [float(initial_capital)]
        portfolio_value = float(initial_capital)
        for t in range(1, len(state_path)):
            held_yesterday = state_path[t - 1][1]
            previous_price = p.iloc[t - 1][held_yesterday]
            current_price = p.iloc[t][held_yesterday]
            if not (np.isfinite(previous_price) and np.isfinite(current_price) and previous_price > 0):
                raise ValueError(
                    f"Missing price while holding {held_yesterday} between "
                    f"{dates[t-1].date()} and {dates[t].date()}. "
                    "Repair or verify the source data before trusting this backtest."
                )
            portfolio_value *= float(current_price / previous_price)
            portfolio_values.append(portfolio_value)
        equity[cap] = pd.Series(
            portfolio_values, index=[item[0] for item in state_path],
            name=f"At most {cap} switches"
        )
        summaries.append({
            "Maximum switches": cap,
            "Actual switches": used_k,
            "Final value (USD)": value,
            "Profit (USD)": value - initial_capital,
            "Return (%)": (value / initial_capital - 1) * 100,
            "Ending asset": assets[end_j],
        })
    return StrategyResult(pd.DataFrame(summaries), paths, equity)


def buy_and_hold(prices: pd.DataFrame, initial_capital: float = 1480.0,
                 start_date: str = START_DATE) -> pd.DataFrame:
    p = clean_prices(prices)
    rows = []
    for asset in ASSETS:
        series = p.loc[p.index >= pd.Timestamp(start_date), asset].dropna()
        if series.empty:
            continue
        first_date, last_date = series.index[0], series.index[-1]
        # For SOL, this starts on its first available observation, not in 2016.
        final_value = initial_capital * series.iloc[-1] / series.iloc[0]
        rows.append({
            "Asset": asset,
            "Entry date": first_date.date(),
            "Last price date": last_date.date(),
            "Final value (USD)": final_value,
            "Profit (USD)": final_value - initial_capital,
            "Return (%)": (final_value / initial_capital - 1) * 100,
        })
    return pd.DataFrame(rows)


def max_drawdown(equity: pd.Series) -> float:
    s = equity.dropna()
    if s.empty:
        return float("nan")
    peak = s.cummax()
    return float(((s / peak) - 1).min() * 100)
