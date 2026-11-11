import itertools
import unittest

import numpy as np
import pandas as pd

from crypto_engine import optimal_switching


def exhaustive_best_value(prices: pd.DataFrame, capital: float, max_switches: int) -> float:
    """Independent brute-force oracle for small test datasets."""
    assets = list(prices.columns)
    best = -np.inf
    for tail in itertools.product(assets, repeat=len(prices) - 1):
        states = ("Bitcoin",) + tail
        switches = sum(states[i] != states[i - 1] for i in range(1, len(states)))
        if switches > max_switches:
            continue
        value = float(capital)
        valid = True
        for t in range(1, len(prices)):
            held_yesterday = states[t - 1]
            old_price = prices.iloc[t - 1][held_yesterday]
            new_price = prices.iloc[t][held_yesterday]
            target_price = prices.iloc[t][states[t]]
            if pd.isna(old_price) or pd.isna(new_price) or pd.isna(target_price):
                valid = False
                break
            value *= float(new_price / old_price)
        if valid:
            best = max(best, value)
    return best


class ExhaustiveOptimizerValidation(unittest.TestCase):
    def test_dynamic_programming_matches_brute_force(self):
        dates = pd.date_range("2020-01-01", periods=6, freq="D")
        prices = pd.DataFrame(
            {
                "Bitcoin": [100, 110, 100, 90, 120, 130],
                "Ethereum": [10, 10, 15, 20, 18, 30],
                "Solana": [np.nan, np.nan, 5, 10, 8, 40],
            },
            index=dates,
        )
        for cap in range(4):
            result = optimal_switching(prices, 1000, cap, "2020-01-01")
            actual = float(result.summary.loc[
                result.summary["Maximum switches"] == cap, "Final value (USD)"
            ].iloc[0])
            expected = exhaustive_best_value(prices, 1000, cap)
            self.assertAlmostEqual(actual, expected, places=8)


if __name__ == "__main__":
    unittest.main()
