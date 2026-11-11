from __future__ import annotations
from dataclasses import dataclass
import numpy as np
import pandas as pd
from crypto_engine import clean_prices

ASSET_NAMES = ("Bitcoin", "Ethereum", "Solana")

@dataclass
class ConstrainedResult:
    summary: pd.DataFrame
    equity_curves: dict[str, pd.Series]
    holdings: dict[str, pd.Series]
    trades: dict[str, pd.DataFrame]
    diagnostics: dict[str, pd.DataFrame]
    drawdown_traces: dict[str, pd.DataFrame]

def build_scores(prices: pd.DataFrame, strategy: str) -> pd.DataFrame:
    p = clean_prices(prices)
    if strategy == "A: 90-day momentum":
        return p / p.shift(90) - 1
    if strategy == "B: 50/200-day trend + momentum":
        sma50, sma200 = p.rolling(50, min_periods=50).mean(), p.rolling(200, min_periods=200).mean()
        return (p / p.shift(90) - 1).where((p > sma50) & (p > sma200))
    if strategy == "C: 30/90/180-day momentum":
        return .2*(p/p.shift(30)-1) + .3*(p/p.shift(90)-1) + .5*(p/p.shift(180)-1)
    raise ValueError(f"Unknown strategy: {strategy}")

def _is_rebalance_date(date, frequency, anchor):
    if frequency == "Daily": return True
    if frequency == "Weekly": return date.weekday() == anchor.weekday()
    if frequency == "Every 15 days": return (date-anchor).days % 15 == 0
    if frequency == "Monthly": return date.month != (date-pd.Timedelta(days=1)).month or date == anchor
    raise ValueError(f"Unsupported rebalance frequency: {frequency}")

def _metrics(equity, returns, switches, cash_days):
    eq, r = equity.dropna(), returns.reindex(equity.index).fillna(0)
    years = max((eq.index[-1]-eq.index[0]).days/365.25, 1/365.25)
    total = eq.iloc[-1]/eq.iloc[0]-1
    dd = eq/eq.cummax()-1
    vol = r.std(ddof=1)*np.sqrt(365) if len(r)>1 else np.nan
    sharpe = r.mean()*365/vol if pd.notna(vol) and vol>0 else np.nan
    return {
        "Final value (USD)":float(eq.iloc[-1]), "Total return (%)":total*100,
        "CAGR (%)":((eq.iloc[-1]/eq.iloc[0])**(1/years)-1)*100 if eq.iloc[-1]>0 else np.nan,
        "Maximum drawdown (%)":dd.min()*100, "Annualized volatility (%)":vol*100,
        "Sharpe (rf=0)":sharpe, "Switches":int(switches), "Cash days":int(cash_days)
    }

def run_constrained_backtest(
    prices, strategy, initial_capital=1480.0, start_date="2016-11-09", end_date=None,
    rebalance_frequency="Weekly", minimum_holding_days=14, switching_threshold_pct=5.0,
    fee_bps_per_switch=10.0, allow_cash=True, cash_when_no_positive_score=True,
    drawdown_protection_pct=20.0, cash_reentry_score_pct=0.0,
    indicator_history=None, enable_cash_filter=None, enable_drawdown_protection=None,
    initialization_mode="Invest immediately in Bitcoin"
):
    """Close-based daily simulation. A close-t decision determines exposure for t->t+1.
    Drawdown exits are checked every close, independent of rebalance schedule.
    Cash-filter allocation and drawdown lock are independently switchable.
    """
    if enable_cash_filter is not None: cash_when_no_positive_score = bool(enable_cash_filter)
    if enable_drawdown_protection is not None:
        drawdown_protection_pct = float(drawdown_protection_pct) if enable_drawdown_protection else 0.0
    allow_cash = bool(allow_cash)
    full = clean_prices(indicator_history if indicator_history is not None else prices)
    start, end = pd.Timestamp(start_date), pd.Timestamp(end_date) if end_date else full.index.max()
    history = full.loc[full.index <= end]
    p = history.loc[(history.index >= start) & (history.index <= end)].dropna(how="all")
    if len(p)<2: raise ValueError("Not enough observations in evaluation period.")
    scores = build_scores(history, strategy).reindex(p.index).replace([np.inf,-np.inf],np.nan)
    daily_returns = p.pct_change(fill_method=None)
    dates = list(p.index)
    if initialization_mode not in ("Invest immediately in Bitcoin", "Wait for first valid signal"):
        raise ValueError("Unsupported initialization mode.")
    holding = "Bitcoin" if initialization_mode == "Invest immediately in Bitcoin" else "USD Cash"
    last_switch = dates[0]
    nav = float(initial_capital)
    peak = nav
    dd_lock = False
    eq_values, ret_values, holding_values = [], [], []
    trade_rows, diag_rows, trace_rows = [], [], []
    fee_rate = float(fee_bps_per_switch)/10000
    cash_filter_on = allow_cash and bool(cash_when_no_positive_score)
    dd_protection_on = allow_cash and float(drawdown_protection_pct)>0

    for i, dt in enumerate(dates):
        # Current close-to-close interval was earned by the holding selected at prior close.
        previous_nav = nav
        previous_peak = peak
        interval_return_pct = 0.0
        interval_asset = holding
        if i:
            if holding != "USD Cash":
                rr = daily_returns.at[dt, holding]
                rr = float(rr) if pd.notna(rr) else 0.0
                interval_return_pct = rr * 100
                nav *= (1+rr)
        peak_before_mark = peak
        peak = max(peak, nav)
        drawdown = (nav/peak-1)*100 if peak else 0.0
        pre_decision_holding = holding
        score_row = scores.loc[dt].dropna()
        best_asset = str(score_row.idxmax()) if not score_row.empty else None
        best_score = float(score_row.max()) if best_asset else np.nan
        scheduled = _is_rebalance_date(dt, rebalance_frequency, dates[0])
        reason = None
        target = holding

        # Drawdown risk is evaluated daily and overrides rebalance/holding constraints.
        if dd_protection_on and holding != "USD Cash" and drawdown <= -float(drawdown_protection_pct):
            dd_lock = True
            target = "USD Cash"
            reason = "Drawdown protection"
        elif holding == "USD Cash" and dd_lock:
            # Re-entry after a drawdown lock is considered only on scheduled dates.
            if scheduled and best_asset and best_score*100 >= float(cash_reentry_score_pct):
                target, reason, dd_lock = best_asset, "Drawdown recovery re-entry", False
        elif scheduled:
            if best_asset is None:
                # No indicator is available yet: preserve the selected initialization
                # mode rather than treating missing history as a negative signal.
                target = holding
            elif cash_filter_on and best_score <= 0:
                target, reason = "USD Cash", "Cash filter"
            elif best_asset is not None:
                if holding == "USD Cash":
                    target, reason = best_asset, "Momentum re-entry"
                elif best_asset != holding:
                    current_score = score_row.get(holding, np.nan)
                    advantage_ok = pd.isna(current_score) or (best_score-float(current_score))*100 >= switching_threshold_pct
                    hold_ok = (dt-last_switch).days >= minimum_holding_days
                    if advantage_ok and hold_ok:
                        target, reason = best_asset, "Strategy signal"

        triggered = bool(dd_protection_on and pre_decision_holding != "USD Cash"
                         and drawdown <= -float(drawdown_protection_pct))
        trace_rows.append({
            "Date": dt,
            "Holding during close-to-close interval": interval_asset,
            "Holding before decision": pre_decision_holding,
            "Previous close portfolio value (USD)": previous_nav,
            "Portfolio value before decision (USD)": nav,
            "Previous high-water mark (USD)": previous_peak,
            "High-water mark before decision (USD)": peak,
            "High-water mark updated today": bool(peak > peak_before_mark),
            "Close-to-close portfolio return (%)": interval_return_pct,
            "Drawdown before decision (%)": drawdown,
            "Protection threshold (%)": -float(drawdown_protection_pct) if dd_protection_on else np.nan,
            "Drawdown trigger breached": triggered,
            "Scheduled rebalance": scheduled,
            "Decision": reason or "No switch",
            "Holding after decision": target,
            "Execution assumption": "Signal detected and executed at same daily close",
            "Fee rate (bps)": float(fee_bps_per_switch),
        })
        if target != holding:
            old = holding
            holding = target
            last_switch = dt
            # After a drawdown-protection cash lock, establish a fresh high-water
            # mark at re-entry. Otherwise the old peak would immediately retrigger
            # the stop on the next day, causing repeated cash/crypto churn.
            if old == "USD Cash" and reason == "Drawdown recovery re-entry":
                peak = nav
            nav *= (1-fee_rate)
            trade_rows.append({
                "Signal date":dt, "Signal / execution date":dt, "From":old, "To":holding, "Reason":reason,
                "Portfolio value after fee (USD)":nav, "Peak before decision (USD)":peak,
                "Drawdown at decision (%)":drawdown,
                "Best asset":best_asset, "Best score (%)":best_score*100 if pd.notna(best_score) else np.nan
            })
            diag_rows.append({
                "Date":dt, "Event":reason, "From":old, "To":holding,
                "Portfolio value (USD)":nav, "Peak portfolio value (USD)":peak,
                "Drawdown (%)":drawdown, "Best asset":best_asset,
                "Best score (%)":best_score*100 if pd.notna(best_score) else np.nan,
                "Scheduled rebalance":scheduled
            })

        eq_values.append(nav)
        ret_values.append(nav/eq_values[-2]-1 if len(eq_values)>1 and eq_values[-2] else 0.0)
        holding_values.append(holding)

    equity = pd.Series(eq_values,index=p.index,name="Portfolio value (USD)")
    lifetime_peak = equity.cummax()
    lifetime_drawdown = equity / lifetime_peak - 1
    returns = pd.Series(ret_values,index=p.index,name="Daily return")
    holdings = pd.Series(holding_values,index=p.index,name="Holding")
    trades = pd.DataFrame(trade_rows, columns=["Signal date","Signal / execution date","From","To","Reason","Portfolio value after fee (USD)","Peak before decision (USD)","Drawdown at decision (%)","Best asset","Best score (%)"])
    diagnostics = pd.DataFrame(diag_rows, columns=["Date","Event","From","To","Portfolio value (USD)","Peak portfolio value (USD)","Drawdown (%)","Best asset","Best score (%)","Scheduled rebalance"])
    drawdown_trace = pd.DataFrame(trace_rows)
    cash_days = int((holdings=="USD Cash").sum())
    key=f"{strategy} | {rebalance_frequency} | cash_filter={cash_filter_on} | DD={drawdown_protection_pct if dd_protection_on else 0:g}%"
    summary_row={
        "Strategy":strategy,"Rebalance":rebalance_frequency,"Minimum hold (days)":minimum_holding_days,
        "Switch threshold (%)":switching_threshold_pct,"Fee per switch (bps)":fee_bps_per_switch,
        "Cash enabled":allow_cash,"Cash filter":cash_filter_on,
        "Drawdown protection (%)":float(drawdown_protection_pct) if dd_protection_on else 0.0,
        "Initialization mode": initialization_mode,
        "Lifetime max drawdown (%)": float(lifetime_drawdown.min() * 100),
        **_metrics(equity,returns,len(trades),cash_days)
    }
    return ConstrainedResult(pd.DataFrame([summary_row]),{key:equity},{key:holdings},{key:trades},{key:diagnostics},{key:drawdown_trace})

def run_benchmark(prices, asset, initial_capital=1480.0, start_date="2016-11-09", end_date=None):
    p=clean_prices(prices)
    p=p.loc[(p.index>=pd.Timestamp(start_date)) & (p.index<=(pd.Timestamp(end_date) if end_date else p.index.max()))]
    s=p[asset].dropna()
    if len(s)<2: raise ValueError(f"Insufficient observations for {asset} benchmark.")
    # Buy at first valid close, hold through last available close.
    equity=initial_capital*s/s.iloc[0]
    returns=equity.pct_change(fill_method=None).fillna(0)
    peak=equity.cummax()
    dd=equity/peak-1
    years=max((equity.index[-1]-equity.index[0]).days/365.25,1/365.25)
    vol=returns.std(ddof=1)*np.sqrt(365)
    row={"Strategy":f"Buy & hold: {asset}","Final value (USD)":equity.iloc[-1],
         "Total return (%)":(equity.iloc[-1]/initial_capital-1)*100,
         "CAGR (%)":((equity.iloc[-1]/initial_capital)**(1/years)-1)*100,
         "Maximum drawdown (%)":dd.min()*100,"Annualized volatility (%)":vol*100,
         "Sharpe (rf=0)":returns.mean()*365/vol if vol>0 else np.nan,
         "Switches":0,"Cash days":0}
    return pd.DataFrame([row]),equity

def compare_protection_modes(prices,strategy,initial_capital=1480,start_date="2016-11-09",end_date=None,
    rebalance_frequency="Monthly",minimum_holding_days=30,switching_threshold_pct=10,
    fee_bps_per_switch=10,drawdown_protection_pct=20,cash_reentry_score_pct=0,
    initialization_mode="Invest immediately in Bitcoin"):
    modes=[
        ("A – Cash filter only",True,False),
        ("B – Drawdown protection only",False,True),
        ("C – Combined protection",True,True),
        ("D – No cash protection",False,False)
    ]
    summaries=[]; curves={}; holdings={}; trades={}; diagnostics={}
    for label,cash_filter,dd_on in modes:
        res=run_constrained_backtest(prices,strategy,initial_capital,start_date,end_date,
            rebalance_frequency,minimum_holding_days,switching_threshold_pct,fee_bps_per_switch,
            allow_cash=True,cash_when_no_positive_score=cash_filter,
            drawdown_protection_pct=drawdown_protection_pct if dd_on else 0,
            cash_reentry_score_pct=cash_reentry_score_pct,
            initialization_mode=initialization_mode)
        row=res.summary.iloc[0].to_dict(); row["Experiment"]=label; summaries.append(row)
        k=next(iter(res.equity_curves)); curves[label]=res.equity_curves[k]
        holdings[label]=res.holdings[k]; trades[label]=res.trades[k]; diagnostics[label]=res.diagnostics[k]
        diagnostics[f"{label} – Daily drawdown trace"] = res.drawdown_traces[k]
    # Buy-and-hold benchmarks are reference rows, not protection modes.
    for asset in ("Bitcoin","Ethereum","Solana"):
        try:
            row_df,curve=run_benchmark(prices,asset,initial_capital,start_date,end_date)
            row=row_df.iloc[0].to_dict()
            row["Experiment"]=f"Benchmark – {asset}"; summaries.append(row); curves[f"Benchmark – {asset}"]=curve
        except ValueError: pass
    return pd.DataFrame(summaries),curves,holdings,trades,diagnostics

def walk_forward_report(prices,strategy,initial_capital=1480,fee_bps_per_switch=10,
    rebalance_frequency="Weekly",minimum_holding_days=14,switching_threshold_pct=5,
    allow_cash=True,drawdown_protection_pct=20,cash_filter=True,cash_reentry_score_pct=0,
    initialization_mode="Invest immediately in Bitcoin"):
    p=clean_prices(prices)
    splits=[("Development","2016-11-09","2022-12-31"),("Validation","2023-01-01","2024-12-31"),("Test","2025-01-01","2026-11-09")]
    rows=[]
    for label,start,end in splits:
        # Full data only through this segment's end; prior rows provide indicator warm-up.
        res=run_constrained_backtest(p,strategy,initial_capital,start,end,rebalance_frequency,
            minimum_holding_days,switching_threshold_pct,fee_bps_per_switch,allow_cash,
            cash_filter,drawdown_protection_pct,cash_reentry_score_pct,
            indicator_history=p.loc[p.index<=pd.Timestamp(end)],
            initialization_mode=initialization_mode)
        row=res.summary.iloc[0].to_dict(); row["Period"]=label; rows.append(row)
    return pd.DataFrame(rows)
