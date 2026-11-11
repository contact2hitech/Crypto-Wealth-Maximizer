from __future__ import annotations
import pandas as pd
import numpy as np
from optimization_engine import run_constrained_backtest, build_scores

def classify_market_regimes(prices: pd.DataFrame) -> pd.DataFrame:
    """Causal BTC regime labels using only close, 90-day return and 200-day SMA."""
    p = prices.copy()
    btc = p["Bitcoin"].ffill()
    sma200 = btc.rolling(200, min_periods=200).mean()
    ret90 = btc.pct_change(90, fill_method=None)
    regime = pd.Series("Sideways / mixed", index=p.index, dtype="object")
    regime.loc[(btc > sma200) & (ret90 > 0)] = "Bull"
    regime.loc[(btc < sma200) & (ret90 < 0)] = "Bear"
    out = pd.DataFrame({"Bitcoin close": btc, "BTC SMA 200": sma200,
                        "BTC 90-day return (%)": ret90 * 100, "Market regime": regime})
    out.loc[sma200.isna() | ret90.isna(), "Market regime"] = "Insufficient history"
    return out

def regime_performance(prices, equity, holdings) -> pd.DataFrame:
    regimes = classify_market_regimes(prices).reindex(equity.index)
    daily_ret = equity.pct_change(fill_method=None).fillna(0)
    frame = pd.DataFrame({"Return": daily_ret, "Regime": regimes["Market regime"],
                          "Holding": holdings.reindex(equity.index)})
    rows=[]
    for name, g in frame.groupby("Regime", sort=False):
        if g.empty: continue
        growth = (1 + g["Return"]).prod()
        rows.append({"Market regime":name, "Days":len(g),
                     "Portfolio return in regime (%)":(growth-1)*100,
                     "Average daily return (%)":g["Return"].mean()*100,
                     "Positive days (%)":(g["Return"]>0).mean()*100,
                     "Cash days":int((g["Holding"]=="USD Cash").sum())})
    return pd.DataFrame(rows)

def asset_attribution(equity, holdings) -> pd.DataFrame:
    """Daily portfolio-return attribution by asset held at the start of each close interval."""
    ret = equity.pct_change(fill_method=None).fillna(0)
    h = holdings.reindex(equity.index)
    rows=[]
    for asset in ["Bitcoin","Ethereum","Solana","USD Cash"]:
        mask = h.eq(asset)
        r = ret[mask]
        rows.append({"Holding":asset, "Days held":int(mask.sum()),
                     "Exposure (%)":float(mask.mean()*100),
                     "Compounded return during holding days (%)":float(((1+r).prod()-1)*100),
                     "Sum of daily portfolio returns (%)":float(r.sum()*100),
                     "Positive holding days (%)":float((r>0).mean()*100) if len(r) else np.nan})
    return pd.DataFrame(rows)

def protection_effectiveness(diagnostics: pd.DataFrame, trigger_pct: float = 20.0) -> tuple[pd.DataFrame,pd.DataFrame]:
    if diagnostics.empty:
        return pd.DataFrame(), pd.DataFrame()
    events = diagnostics.copy()
    counts = events.groupby("Event").agg(
        Events=("Date","count"),
        Mean_drawdown_pct=("Drawdown (%)","mean"),
        Worst_drawdown_pct=("Drawdown (%)","min"),
        Median_drawdown_pct=("Drawdown (%)","median")
    ).reset_index()
    exits = events[events["Event"]=="Drawdown protection"].copy()
    if not exits.empty:
        exits["Overshoot beyond configured trigger (pp)"] = (-exits["Drawdown (%)"] - float(trigger_pct)).clip(lower=0)
    return counts, exits

def parameter_sensitivity(prices, initial_capital, start_date, end_date,
                          rebalance_frequency, minimum_holding_days,
                          switching_threshold_pct, fee_bps_per_switch,
                          cash_reentry_score_pct, initialization_mode,
                          strategies=None, drawdown_triggers=(10,20,30)):
    """Small, predeclared grid; descriptive sensitivity, not an optimizer."""
    strategies = strategies or ["A: 90-day momentum",
        "B: 50/200-day trend + momentum", "C: 30/90/180-day momentum"]
    rows=[]
    for strategy in strategies:
        for trigger in drawdown_triggers:
            result = run_constrained_backtest(
                prices, strategy, initial_capital, start_date, end_date,
                rebalance_frequency, minimum_holding_days, switching_threshold_pct,
                fee_bps_per_switch, allow_cash=True, cash_when_no_positive_score=True,
                drawdown_protection_pct=float(trigger),
                cash_reentry_score_pct=cash_reentry_score_pct,
                initialization_mode=initialization_mode)
            row=result.summary.iloc[0].to_dict()
            row["Sensitivity strategy"]=strategy
            row["Drawdown trigger (%)"]=trigger
            rows.append(row)
    return pd.DataFrame(rows)
