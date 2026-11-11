"""Independent path/value consistency audit for the real historical dataset."""
import numpy as np
import pandas as pd

from crypto_engine import optimal_switching, max_drawdown

DATA = "data/crypto_daily_prices.csv"
INITIAL_CAPITAL = 1480.0
START_DATE = "2016-11-09"
MAX_SWITCHES = 10

prices = pd.read_csv(DATA, parse_dates=["Date"]).set_index("Date")
prices = prices[["Bitcoin", "Ethereum", "Solana"]]
result = optimal_switching(prices, INITIAL_CAPITAL, MAX_SWITCHES, START_DATE)

print("OPTIMIZER VALIDATION")
print("====================")
for _, row in result.summary.iterrows():
    cap = int(row["Maximum switches"])
    switches = result.paths[cap]
    held = "Bitcoin"
    value = INITIAL_CAPITAL
    # Daily close convention: accrue the previous holding to today's close,
    # then execute a switch at today's close for the next day's return.
    for i in range(1, len(prices)):
        d0, d1 = prices.index[i - 1], prices.index[i]
        p0, p1 = prices.loc[d0, held], prices.loc[d1, held]
        if pd.isna(p0) or pd.isna(p1) or p0 <= 0:
            raise AssertionError(f"Invalid held-asset price for {held}: {d0} -> {d1}")
        value *= float(p1 / p0)
        for switch_date, next_asset in switches:
            if pd.Timestamp(switch_date) == d1:
                if pd.isna(prices.loc[d1, next_asset]):
                    raise AssertionError(f"Cannot switch into {next_asset} on {d1}")
                held = next_asset
    curve_value = float(result.equity_curves[cap].iloc[-1])
    expected = float(row["Final value (USD)"])
    if not np.isclose(value, expected, rtol=1e-10, atol=1e-7):
        raise AssertionError(f"Cap {cap}: reconstructed {value} != optimizer {expected}")
    if not np.isclose(curve_value, expected, rtol=1e-10, atol=1e-7):
        raise AssertionError(f"Cap {cap}: curve {curve_value} != optimizer {expected}")
    print(
        f"{cap:2d} max switches | {int(row['Actual switches']):2d} used | "
        f"${expected:,.2f} | max drawdown {max_drawdown(result.equity_curves[cap]):.2f}% | PASS"
    )

print("All reconstructed paths match the optimizer and equity curves.")
