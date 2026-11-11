import streamlit as st
import pandas as pd
import plotly.express as px
from pathlib import Path

from strategy_engine import run_practical_strategies
from optimization_engine import (run_constrained_backtest, walk_forward_report, compare_protection_modes)
from robustness_engine import (regime_performance, asset_attribution, protection_effectiveness, parameter_sensitivity)

from crypto_engine import (
    ASSETS, START_DATE, END_DATE, clean_prices, load_prices,
    normalized_indices, common_start_indices, find_crossovers,
    optimal_switching, buy_and_hold, max_drawdown
)

st.set_page_config(page_title="Crypto Wealth Maximizer", page_icon="₿", layout="wide")
st.title("₿ Crypto Wealth Maximizer")
st.caption("Historical BTC / ETH / SOL comparison and perfect-hindsight switching backtest")

with st.sidebar:
    st.header("Simulation settings")
    capital = st.number_input("Initial capital (USD)", min_value=1.0, value=1480.0, step=100.0)
    start = st.date_input("Start date", value=pd.Timestamp(START_DATE).date())
    end = st.date_input("End date", value=pd.Timestamp(END_DATE).date())
    switch_cap = st.select_slider("Maximum switches to optimize", options=[0, 1, 2, 3, 5, 10], value=5)
    uploaded = st.file_uploader("Optional price CSV", type=["csv"])
    refresh = st.button("Refresh downloaded data")

st.info(
    "Research mode: results are hypothetical and use daily closing prices. "
    "The optimizer has perfect knowledge of future prices; it is an upper-bound "
    "experiment, not an investable signal. Fees, taxes, spreads and slippage are excluded."
)

try:
    prices = clean_prices(load_prices(uploaded_file=uploaded, force_download=refresh))
except Exception as exc:
    st.error(f"Could not load historical prices: {exc}")
    st.markdown(
        "Expected CSV columns: `Date,Bitcoin,Ethereum,Solana` (or `BTC-USD,ETH-USD,SOL-USD`). "
        "Dates should be daily and prices denominated in USD."
    )
    st.stop()

prices = prices.loc[(prices.index >= pd.Timestamp(start)) & (prices.index <= pd.Timestamp(end))]
if prices.empty:
    st.warning("No observations in the selected date range.")
    st.stop()

latest = prices.dropna(how="all").iloc[-1]
cols = st.columns(3)
for col, asset in zip(cols, ASSETS):
    with col:
        val = latest.get(asset)
        st.metric(f"{asset} latest close", f"${val:,.4f}" if pd.notna(val) else "Unavailable")

st.subheader("1. Historical prices (USD)")
price_long = prices.reset_index().melt(id_vars="Date", var_name="Asset", value_name="Price (USD)").dropna()
fig = px.line(price_long, x="Date", y="Price (USD)", color="Asset", title="Daily closing prices")
fig.update_layout(legend_title_text="", hovermode="x unified")
st.plotly_chart(fig, use_container_width=True)

st.subheader("2. Normalized performance")
st.caption("Each asset is indexed to 100 on its own first available date. Use the common-start chart below for a fair three-way comparison.")
idx = normalized_indices(prices)
idx_long = idx.reset_index().melt(id_vars="Date", var_name="Asset", value_name="Index (100 = first observation)").dropna()
fig2 = px.line(idx_long, x="Date", y="Index (100 = first observation)", color="Asset")
fig2.update_layout(hovermode="x unified")
st.plotly_chart(fig2, use_container_width=True)

st.subheader("3. Fair comparison from the first date all three existed")
common = common_start_indices(prices)
common_long = common.reset_index().melt(id_vars="Date", var_name="Asset", value_name="Index (100 = common start)").dropna()
if common_long.empty:
    st.warning("There is not yet a date range with valid prices for all three assets.")
else:
    fig3 = px.line(common_long, x="Date", y="Index (100 = common start)", color="Asset")
    fig3.update_layout(hovermode="x unified")
    st.plotly_chart(fig3, use_container_width=True)

st.subheader("4. Relative-performance crossover dates")
cross = find_crossovers(prices)
if cross.empty:
    st.write("No crossover observations found in the selected range.")
else:
    st.dataframe(cross, use_container_width=True, hide_index=True)

st.subheader("5. Buy-and-hold comparison")
bh = buy_and_hold(prices, capital, str(start))
st.dataframe(bh.style.format({
    "Final value (USD)": "${:,.2f}", "Profit (USD)": "${:,.2f}", "Return (%)": "{:,.2f}%"
}), use_container_width=True, hide_index=True)

st.subheader("6. Perfect-hindsight switching optimizer")
try:
    result = optimal_switching(prices, capital, switch_cap, str(start))
    st.dataframe(result.summary.style.format({
        "Final value (USD)": "${:,.2f}", "Profit (USD)": "${:,.2f}", "Return (%)": "{:,.2f}%"
    }), use_container_width=True, hide_index=True)

    chosen_cap = st.selectbox("Show switching path for cap", options=list(result.paths), index=len(result.paths)-1)
    switches = result.paths[chosen_cap]
    if switches:
        st.write("Switch dates (at daily close):")
        st.dataframe(pd.DataFrame(switches, columns=["Switch date", "Switch into"]), hide_index=True)
    else:
        st.write("No switches in this optimized strategy.")

    curve = result.equity_curves.get(chosen_cap)
    if curve is not None:
        curve_df = curve.rename("Portfolio value (USD)").rename_axis("Date").reset_index()
        fig4 = px.line(curve_df, x="Date", y="Portfolio value (USD)", title=f"Optimized equity curve — up to {chosen_cap} switches")
        st.plotly_chart(fig4, use_container_width=True)
        st.metric("Maximum drawdown of displayed optimizer curve", f"{max_drawdown(curve):.2f}%")
except Exception as exc:
    st.error(f"Optimizer could not run: {exc}")

st.subheader("7. Data quality")
quality = pd.DataFrame({
    "Asset": list(ASSETS),
    "First available date": [prices[a].first_valid_index() for a in ASSETS],
    "Last available date": [prices[a].last_valid_index() for a in ASSETS],
    "Valid daily observations": [int(prices[a].notna().sum()) for a in ASSETS],
    "Missing observations": [int(prices[a].isna().sum()) for a in ASSETS],
})
st.dataframe(quality, use_container_width=True, hide_index=True)

st.download_button(
    "Download cleaned daily prices (CSV)",
    data=prices.to_csv(index_label="Date").encode("utf-8"),
    file_name="crypto_daily_prices.csv",
    mime="text/csv",
)


st.divider()
st.header("8. Practical strategies (no future knowledge)")
st.caption(
    "Signals use information available at a day's close and are applied to the next "
    "daily return. These are historical simulations, not investment recommendations."
)
fee_bps = st.slider("Estimated transaction cost per switch (basis points)", 0, 100, 0, 5)
try:
    practical = run_practical_strategies(
        prices, initial_capital=capital, start_date=str(start),
        end_date=str(end), fee_bps_per_switch=fee_bps
    )
    st.dataframe(practical.summary.style.format({
        "Final value (USD)": "${:,.2f}",
        "Total return (%)": "{:,.2f}%",
        "CAGR (%)": "{:,.2f}%",
        "Maximum drawdown (%)": "{:,.2f}%",
        "Annualized volatility (%)": "{:,.2f}%",
        "Sharpe (rf=0, daily)": "{:,.2f}",
    }), use_container_width=True, hide_index=True)

    selected_strategy = st.selectbox(
        "Inspect practical strategy",
        options=list(practical.equity_curves.keys()),
        index=1 if len(practical.equity_curves) > 1 else 0,
    )
    selected_curve = practical.equity_curves[selected_strategy]
    practical_curve_df = selected_curve.rename("Portfolio value (USD)").rename_axis("Date").reset_index()
    practical_fig = px.line(
        practical_curve_df, x="Date", y="Portfolio value (USD)",
        title=f"Portfolio growth — {selected_strategy}"
    )
    st.plotly_chart(practical_fig, use_container_width=True)

    if selected_strategy in practical.trades:
        st.write("Historical switches")
        st.dataframe(practical.trades[selected_strategy], use_container_width=True, hide_index=True)
        st.download_button(
            "Download strategy switches (CSV)",
            data=practical.trades[selected_strategy].to_csv(index=False).encode("utf-8"),
            file_name="practical_strategy_switches.csv",
            mime="text/csv",
        )
except Exception as exc:
    st.error(f"Practical strategy analysis could not run: {exc}")


st.divider()
st.header("9. Risk Analytics & Protection Validation Lab")
st.caption(
    "Cash-filter and drawdown-protection rules can now be isolated. Drawdown exits are "
    "checked at every daily close; ordinary portfolio rotation follows the selected rebalance schedule."
)

with st.expander("Backtest configuration", expanded=True):
    opt_strategy = st.selectbox(
        "Strategy",
        ["A: 90-day momentum", "B: 50/200-day trend + momentum", "C: 30/90/180-day momentum"],
        key="opt_strategy",
    )
    opt_freq = st.selectbox("Rebalancing frequency", ["Daily", "Weekly", "Every 15 days", "Monthly"], index=3)
    opt_hold = st.select_slider("Minimum holding period (days)", options=[0, 7, 14, 30, 60], value=30)
    opt_threshold = st.select_slider("Required score advantage to switch (%)", options=[0.0, 1.0, 3.0, 5.0, 10.0, 15.0, 20.0], value=10.0)
    opt_fee = st.select_slider("Transaction cost per switch (basis points)", options=[0, 5, 10, 25, 50, 100], value=10)
    dd_protection = st.select_slider("Drawdown protection trigger (%)", options=[5, 10, 15, 20, 25, 30, 40], value=20)
    reentry_score = st.select_slider("Minimum score for drawdown recovery re-entry (%)", options=[-5, 0, 2, 5, 10], value=0)
    initialization_mode = st.radio(
        "Initial investment handling",
        ["Invest immediately in Bitcoin", "Wait for first valid signal"],
        index=0,
        help="Both modes are available for side-by-side research by rerunning the comparison."
    )

st.subheader("A. Isolate the protection mechanisms")
st.caption(
    "A: cash filter only · B: drawdown protection only · C: both · D: neither. "
    "Bitcoin, Ethereum and Solana buy-and-hold are shown as reference benchmarks."
)
try:
    comparison, curves, holdings_map, trades_map, diagnostics_map = compare_protection_modes(
        prices, opt_strategy, capital, str(start), str(end), opt_freq,
        int(opt_hold), float(opt_threshold), float(opt_fee),
        float(dd_protection), float(reentry_score), initialization_mode
    )
    display_cols = ["Experiment", "Final value (USD)", "Total return (%)", "CAGR (%)",
                    "Maximum drawdown (%)", "Annualized volatility (%)", "Sharpe (rf=0)",
                    "Switches", "Cash days", "Lifetime max drawdown (%)", "Initialization mode"]
    st.dataframe(comparison[display_cols].style.format({
        "Final value (USD)": "${:,.2f}", "Total return (%)": "{:,.2f}%",
        "CAGR (%)": "{:,.2f}%", "Maximum drawdown (%)": "{:,.2f}%",
        "Annualized volatility (%)": "{:,.2f}%", "Sharpe (rf=0)": "{:,.2f}"
    }), use_container_width=True, hide_index=True)

    curve_frame = pd.concat(curves, axis=1).rename_axis("Date").reset_index()
    curve_long = curve_frame.melt(id_vars="Date", var_name="Experiment", value_name="Portfolio value (USD)")
    st.plotly_chart(px.line(curve_long, x="Date", y="Portfolio value (USD)", color="Experiment",
                            title="Equity curves: protection modes and buy-and-hold benchmarks"),
                    use_container_width=True)

    drawdown_frame = pd.DataFrame({
        name: series / series.cummax() - 1 for name, series in curves.items()
    }).rename_axis("Date").reset_index()
    dd_long = drawdown_frame.melt(id_vars="Date", var_name="Experiment", value_name="Drawdown")
    st.plotly_chart(px.line(dd_long, x="Date", y="Drawdown", color="Experiment",
                            title="Underwater / drawdown comparison"),
                    use_container_width=True)

    selected_mode = st.selectbox("Inspect protection experiment",
        options=["A – Cash filter only", "B – Drawdown protection only",
                 "C – Combined protection", "D – No cash protection"])
    selected_diag = diagnostics_map[selected_mode]
    st.write("Risk events and cash-allocation diagnostics")
    st.dataframe(selected_diag, use_container_width=True, hide_index=True)
    st.download_button("Download risk-event diagnostics (CSV)",
        data=selected_diag.to_csv(index=False).encode("utf-8"),
        file_name="risk_event_diagnostics.csv", mime="text/csv")
    selected_trades = trades_map[selected_mode]
    st.write("Switching history")
    st.dataframe(selected_trades, use_container_width=True, hide_index=True)
    st.download_button("Download experiment switching history (CSV)",
        data=selected_trades.to_csv(index=False).encode("utf-8"),
        file_name="protection_mode_switches.csv", mime="text/csv")
    holding_frame = holdings_map[selected_mode].rename("Holding").rename_axis("Date").reset_index()
    st.download_button("Download daily holding / cash allocation history (CSV)",
        data=holding_frame.to_csv(index=False).encode("utf-8"),
        file_name="daily_holding_history.csv", mime="text/csv")
    st.subheader("Daily drawdown execution trace")
    trace_key = f"{selected_mode} – Daily drawdown trace"
    selected_trace = diagnostics_map[trace_key]
    st.caption(
        "One row per evaluation day. The trace records the close-to-close return, "
        "high-water mark, drawdown before the decision, trigger status and assumed "
        "same-close execution. It makes price-gap overshoot visible; it does not "
        "simulate intraday fills."
    )
    st.dataframe(selected_trace, use_container_width=True, hide_index=True)
    st.download_button("Download daily drawdown execution trace (CSV)",
        data=selected_trace.to_csv(index=False).encode("utf-8"),
        file_name="daily_drawdown_execution_trace.csv", mime="text/csv")
except Exception as exc:
    st.error(f"Protection comparison failed: {exc}")

st.subheader("B. Individual risk-engine controls")
st.caption("Use these controls to inspect the combined strategy independently.")
with st.expander("Individual strategy controls", expanded=False):
    single_cash_filter = st.checkbox("Enable positive-score cash filter", value=True, key="single_cash_filter")
    single_dd = st.checkbox("Enable daily drawdown protection", value=True, key="single_dd")
try:
    single_result = run_constrained_backtest(
        prices, opt_strategy, capital, str(start), str(end), opt_freq,
        int(opt_hold), float(opt_threshold), float(opt_fee),
        allow_cash=True, cash_when_no_positive_score=single_cash_filter,
        drawdown_protection_pct=float(dd_protection) if single_dd else 0.0,
        cash_reentry_score_pct=float(reentry_score),
        initialization_mode=initialization_mode
    )
    st.dataframe(single_result.summary.style.format({
        "Final value (USD)": "${:,.2f}", "Total return (%)": "{:,.2f}%",
        "CAGR (%)": "{:,.2f}%", "Maximum drawdown (%)": "{:,.2f}%",
        "Annualized volatility (%)": "{:,.2f}%", "Sharpe (rf=0)": "{:,.2f}"
    }), use_container_width=True, hide_index=True)
except Exception as exc:
    st.warning(f"Individual risk-engine run failed: {exc}")

st.subheader("C. Walk-forward validation")
st.caption("Indicators use earlier historical observations as warm-up. Each period starts with fresh capital; the three periods are independent tests, not one continuous account.")
try:
    wf = walk_forward_report(
        prices, opt_strategy, capital, float(opt_fee), opt_freq, int(opt_hold),
        float(opt_threshold), True, float(dd_protection),
        bool(single_cash_filter), float(reentry_score), initialization_mode
    )
    st.dataframe(wf[["Period", "Final value (USD)", "Total return (%)", "CAGR (%)",
                     "Maximum drawdown (%)", "Annualized volatility (%)",
                     "Sharpe (rf=0)", "Switches", "Cash days"]].style.format({
        "Final value (USD)": "${:,.2f}", "Total return (%)": "{:,.2f}%",
        "CAGR (%)": "{:,.2f}%", "Maximum drawdown (%)": "{:,.2f}%",
        "Annualized volatility (%)": "{:,.2f}%", "Sharpe (rf=0)": "{:,.2f}"
    }), use_container_width=True, hide_index=True)
    st.download_button("Download walk-forward results (CSV)",
        data=wf.to_csv(index=False).encode("utf-8"),
        file_name="walk_forward_results.csv", mime="text/csv")
except Exception as exc:
    st.warning(f"Walk-forward report unavailable: {exc}")


st.divider()
st.header("10. Phase 4.4 — Strategy Robustness Investigation")
st.caption("Investigates market regimes, asset exposure, protection events and predeclared parameter sensitivity. This is analysis, not automatic parameter optimization.")

try:
    robust_result = run_constrained_backtest(
        prices, opt_strategy, capital, str(start), str(end), opt_freq,
        int(opt_hold), float(opt_threshold), float(opt_fee),
        allow_cash=True, cash_when_no_positive_score=True,
        drawdown_protection_pct=float(dd_protection),
        cash_reentry_score_pct=float(reentry_score),
        initialization_mode=initialization_mode
    )
    robust_key = next(iter(robust_result.equity_curves))
    robust_equity = robust_result.equity_curves[robust_key]
    robust_holdings = robust_result.holdings[robust_key]
    robust_events = robust_result.diagnostics[robust_key]

    st.subheader("A. Market regime performance")
    st.caption("Regimes are classified causally from Bitcoin's 200-day moving average and 90-day return. The initial warm-up period is labelled insufficient history.")
    regime_table = regime_performance(prices, robust_equity, robust_holdings)
    st.dataframe(regime_table.style.format({
        "Portfolio return in regime (%)":"{:.2f}%",
        "Average daily return (%)":"{:.3f}%",
        "Positive days (%)":"{:.1f}%"
    }), use_container_width=True, hide_index=True)
    st.download_button("Download market regime analysis (CSV)",
        data=regime_table.to_csv(index=False).encode("utf-8"),
        file_name="market_regime_analysis.csv", mime="text/csv")

    st.subheader("B. Asset exposure and return attribution")
    attribution = asset_attribution(robust_equity, robust_holdings)
    st.dataframe(attribution.style.format({
        "Exposure (%)":"{:.2f}%",
        "Compounded return during holding days (%)":"{:.2f}%",
        "Sum of daily portfolio returns (%)":"{:.2f}%",
        "Positive holding days (%)":"{:.2f}%"
    }), use_container_width=True, hide_index=True)
    st.download_button("Download asset attribution (CSV)",
        data=attribution.to_csv(index=False).encode("utf-8"),
        file_name="asset_attribution.csv", mime="text/csv")

    st.subheader("C. Protection effectiveness")
    event_counts, exit_events = protection_effectiveness(robust_events, float(dd_protection))
    st.write("Event summary")
    st.dataframe(event_counts, use_container_width=True, hide_index=True)
    st.write("Drawdown protection exits")
    st.dataframe(exit_events, use_container_width=True, hide_index=True)
    st.download_button("Download protection exit analysis (CSV)",
        data=exit_events.to_csv(index=False).encode("utf-8"),
        file_name="protection_exit_analysis.csv", mime="text/csv")

    st.subheader("D. Predeclared parameter sensitivity")
    st.caption("Compares three momentum definitions against 10%, 20% and 30% drawdown triggers while holding the other selected controls fixed. Results are not used to auto-select a winner.")
    sensitivity = parameter_sensitivity(
        prices, capital, str(start), str(end), opt_freq, int(opt_hold),
        float(opt_threshold), float(opt_fee), float(reentry_score),
        initialization_mode
    )
    sens_cols = ["Sensitivity strategy", "Drawdown trigger (%)", "Final value (USD)",
                 "CAGR (%)", "Maximum drawdown (%)", "Sharpe (rf=0)", "Switches", "Cash days"]
    st.dataframe(sensitivity[sens_cols].style.format({
        "Final value (USD)":"${:,.2f}", "CAGR (%)":"{:.2f}%",
        "Maximum drawdown (%)":"{:.2f}%", "Sharpe (rf=0)":"{:.2f}"
    }), use_container_width=True, hide_index=True)
    st.download_button("Download parameter sensitivity grid (CSV)",
        data=sensitivity.to_csv(index=False).encode("utf-8"),
        file_name="parameter_sensitivity.csv", mime="text/csv")
except Exception as exc:
    st.error(f"Robustness investigation could not complete: {exc}")


st.divider()
st.header("11. Crypto Wealth Maximizer v1.0 — Project Summary")
st.caption("Final project overview and research documentation. Historical results are hypothetical and are not investment advice.")
st.markdown(
    """
    **Project purpose:** compare practical BTC / ETH / SOL portfolio strategies,
    cash allocation and drawdown controls using historical daily prices.

    **Research workflow:** historical comparison → practical strategies →
    protection-mode comparison → walk-forward validation → robustness analysis.

    **Important limitations**
    - Walk-forward periods are independent and start with fresh capital.
    - Daily-close drawdown protection is not an intraday stop-loss or a guaranteed loss cap.
    - The perfect-hindsight optimizer uses future information and is only an upper-bound illustration.
    - The reviewed held-out Test period was negative; historical development returns must not be treated as expected returns.
    """
)
report_path = Path(__file__).with_name("FINAL_RESEARCH_REPORT.md")
if report_path.exists():
    st.download_button(
        "Download final research report (Markdown)",
        data=report_path.read_text(encoding="utf-8"),
        file_name="Crypto_Wealth_Maximizer_Final_Research_Report.md",
        mime="text/markdown"
    )
release_path = Path(__file__).with_name("RELEASE_NOTES_V1.0.md")
if release_path.exists():
    st.download_button(
        "Download v1.0 release notes",
        data=release_path.read_text(encoding="utf-8"),
        file_name="Crypto_Wealth_Maximizer_v1.0_Release_Notes.md",
        mime="text/markdown"
    )
