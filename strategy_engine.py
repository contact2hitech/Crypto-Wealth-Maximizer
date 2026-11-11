from __future__ import annotations

from dataclasses import dataclass
import numpy as np
import pandas as pd

from crypto_engine import ASSETS, clean_prices


@dataclass
class BacktestResult:
    summary: pd.DataFrame
    equity_curves: dict[str, pd.Series]
    holdings: dict[str, pd.Series]
    trades: dict[str, pd.DataFrame]


def _safe_returns(prices: pd.DataFrame) -> pd.DataFrame:
    """Daily close-to-close returns. Missing observations remain missing."""
    p = clean_prices(prices)
    return p.pct_change(fill_method=None)


def _select_top_score(scores: pd.DataFrame, fallback: str = "Bitcoin") -> pd.Series:
    """Select best eligible asset at each date; use prior holding if no signal."""
    scores = scores.replace([np.inf, -np.inf], np.nan)
    selected = []
    current = fallback
    for dt, row in scores.iterrows():
        eligible = row.dropna()
        if not eligible.empty:
            current = str(eligible.idxmax())
        selected.append(current)
    return pd.Series(selected, index=scores.index, name="Holding")


def _strategy_signals(prices: pd.DataFrame) -> dict[str, pd.Series]:
    p = clean_prices(prices)

    # Strategy A: strongest 90-calendar-observation trailing return.
    mom90 = p / p.shift(90) - 1
    sig90 = _select_top_score(mom90)

    # Strategy B: trend filter: price above both 50- and 200-day simple averages.
    sma50 = p.rolling(50, min_periods=50).mean()
    sma200 = p.rolling(200, min_periods=200).mean()
    trend_ok = (p > sma50) & (p > sma200)
    trend_scores = (p / p.shift(90) - 1).where(trend_ok)
    sig_ma = _select_top_score(trend_scores)

    # Strategy C: weighted multi-horizon momentum. All windows use only past closes.
    mom30 = p / p.shift(30) - 1
    mom90b = p / p.shift(90) - 1
    mom180 = p / p.shift(180) - 1
    composite = 0.2 * mom30 + 0.3 * mom90b + 0.5 * mom180
    sig_multi = _select_top_score(composite)

    return {
        "A: 90-day momentum": sig90,
        "B: 50/200-day trend + momentum": sig_ma,
        "C: 30/90/180-day momentum": sig_multi,
    }


def _metrics(equity: pd.Series, daily_returns: pd.Series, trades_count: int) -> dict:
    equity = equity.dropna()
    daily_returns = daily_returns.reindex(equity.index).fillna(0.0)
    if len(equity) < 2:
        return {}
    years = (equity.index[-1] - equity.index[0]).days / 365.25
    total_return = equity.iloc[-1] / equity.iloc[0] - 1
    cagr = (equity.iloc[-1] / equity.iloc[0]) ** (1 / years) - 1 if years > 0 and equity.iloc[-1] > 0 else np.nan
    peak = equity.cummax()
    drawdown = equity / peak - 1
    vol = daily_returns.std(ddof=1) * np.sqrt(365)
    sharpe = (daily_returns.mean() * 365) / vol if vol and np.isfinite(vol) else np.nan
    return {
        "Final value (USD)": float(equity.iloc[-1]),
        "Total return (%)": float(total_return * 100),
        "CAGR (%)": float(cagr * 100),
        "Maximum drawdown (%)": float(drawdown.min() * 100),
        "Annualized volatility (%)": float(vol * 100),
        "Sharpe (rf=0, daily)": float(sharpe),
        "Switches": int(trades_count),
    }


def run_practical_strategies(
    prices: pd.DataFrame,
    initial_capital: float = 1480.0,
    start_date: str = "2016-11-09",
    end_date: str | None = None,
    fee_bps_per_switch: float = 0.0,
) -> BacktestResult:
    """
    No-lookahead daily-close backtest.

    Signal is computed using close t and applied to return t->t+1 by shifting
    the selected holding one row. Switching fee is charged on each change in
    holding at the execution close. Returns are close-to-close, long-only,
    fully invested in one asset. Assets with no price/return are ineligible.
    """
    p = clean_prices(prices)
    p = p.loc[p.index >= pd.Timestamp(start_date)]
    if end_date:
        p = p.loc[p.index <= pd.Timestamp(end_date)]
    p = p.dropna(how="all")
    if len(p) < 220:
        raise ValueError("At least 220 daily observations are required for these strategies.")

    signals = _strategy_signals(p)
    returns = _safe_returns(p)
    curves, holdings, trades, summaries = {}, {}, {}, []

    # Buy-and-hold BTC reference from the same starting date.
    btc = p["Bitcoin"].dropna()
    if not btc.empty:
        btc = btc.loc[btc.index >= p.index[0]]
        btc_ret = btc.pct_change(fill_method=None).fillna(0.0)
        btc_eq = initial_capital * (1 + btc_ret).cumprod()
        curves["Buy & hold: Bitcoin"] = btc_eq
        summaries.append({
            "Strategy": "Buy & hold: Bitcoin",
            **_metrics(btc_eq, btc_ret, 0),
        })

    for name, signal in signals.items():
        # Signal known at today's close; hold it for the next close-to-close interval.
        held = signal.shift(1)
        # At first row, begin in BTC; no return is credited before first valid close.
        if len(held):
            held.iloc[0] = "Bitcoin"
        held = held.ffill().fillna("Bitcoin")

        # A holding can earn a return only if both endpoints have valid prices.
        asset_returns = pd.Series(index=p.index, dtype=float)
        for dt in p.index:
            asset = held.loc[dt]
            asset_returns.loc[dt] = returns.loc[dt, asset] if pd.notna(returns.loc[dt, asset]) else 0.0

        # Charge costs when selected holding differs from previous day's holding.
        changed = held.ne(held.shift(1))
        if len(changed):
            changed.iloc[0] = False
        fee = fee_bps_per_switch / 10000.0
        net_returns = asset_returns.copy()
        net_returns.loc[changed] = (1 + net_returns.loc[changed]) * (1 - fee) - 1
        equity = initial_capital * (1 + net_returns).cumprod()

        trade_rows = []
        for dt in p.index[changed]:
            trade_rows.append({"Date": dt, "From": held.shift(1).loc[dt], "To": held.loc[dt]})
        trade_df = pd.DataFrame(trade_rows, columns=["Date", "From", "To"])

        curves[name] = equity
        holdings[name] = held
        trades[name] = trade_df
        summaries.append({
            "Strategy": name,
            **_metrics(equity, net_returns, len(trade_df)),
        })

    summary = pd.DataFrame(summaries)
    return BacktestResult(summary, curves, holdings, trades)
