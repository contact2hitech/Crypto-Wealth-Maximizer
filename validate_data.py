"""Audit the cached daily price file without modifying or filling observations."""
from pathlib import Path
import pandas as pd
import numpy as np
from crypto_engine import ASSETS, PRICE_FILE, clean_prices


def main():
    if not PRICE_FILE.exists():
        raise SystemExit(f"Price file not found: {PRICE_FILE}. Run the Streamlit app first.")
    raw = pd.read_csv(PRICE_FILE, parse_dates=["Date"])
    duplicate_dates = int(raw["Date"].duplicated().sum())
    prices = clean_prices(raw.set_index("Date"))
    print("DATASET AUDIT")
    print("=============")
    print(f"Rows: {len(prices):,}")
    print(f"Duplicate date rows in source: {duplicate_dates}")
    print(f"Date range: {prices.index.min().date()} to {prices.index.max().date()}")
    for asset in ASSETS:
        s = prices[asset]
        valid = s.dropna()
        daily_returns = valid.pct_change().dropna()
        outliers = daily_returns[daily_returns.abs() > 0.50]
        print(f"\n{asset}")
        print(f"  First valid date: {valid.index.min().date() if len(valid) else 'N/A'}")
        print(f"  Last valid date:  {valid.index.max().date() if len(valid) else 'N/A'}")
        print(f"  Valid observations: {valid.size:,}")
        print(f"  Missing observations: {s.isna().sum():,}")
        print(f"  Non-positive prices: {(s.dropna() <= 0).sum():,}")
        print(f"  Absolute daily returns above 50% (review, not auto-delete): {len(outliers)}")
        if len(outliers):
            print(outliers.to_string())
    print("\nNo missing observations have been forward-filled or fabricated.")

if __name__ == "__main__":
    main()
