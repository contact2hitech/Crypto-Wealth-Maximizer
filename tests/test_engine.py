import unittest
import pandas as pd
from crypto_engine import optimal_switching

class OptimizerTests(unittest.TestCase):
    def setUp(self):
        dates = pd.date_range("2020-01-01", periods=6, freq="D")
        self.prices = pd.DataFrame({
            "Bitcoin": [100, 110, 121, 133.1, 146.41, 161.051],
            "Ethereum": [10, 11, 12.1, 13.31, 14.641, 16.1051],
            "Solana": [None, None, 10, 20, 40, 80],
        }, index=dates)

    def test_equity_curve_ends_at_optimizer_final_value(self):
        result = optimal_switching(self.prices, 1000, 2, "2020-01-01")
        for cap, curve in result.equity_curves.items():
            final_value = result.summary.loc[
                result.summary["Maximum switches"] == cap, "Final value (USD)"
            ].iloc[0]
            self.assertAlmostEqual(float(curve.iloc[-1]), float(final_value), places=7)

    def test_zero_switches_stays_in_bitcoin(self):
        result = optimal_switching(self.prices, 1000, 0, "2020-01-01")
        row = result.summary.iloc[0]
        self.assertEqual(int(row["Actual switches"]), 0)
        self.assertEqual(row["Ending asset"], "Bitcoin")
        self.assertEqual(len(result.paths[0]), 0)

    def test_sol_cannot_be_used_before_first_price(self):
        result = optimal_switching(self.prices, 1000, 1, "2020-01-01")
        switches = result.paths[1]
        self.assertTrue(all(date >= pd.Timestamp("2020-01-03") for date, _ in switches))

if __name__ == "__main__":
    unittest.main()
