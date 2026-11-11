import unittest
import numpy as np
import pandas as pd
from optimization_engine import run_constrained_backtest, walk_forward_report


class OptimizationLabTests(unittest.TestCase):
    def setUp(self):
        dates = pd.date_range("2016-11-09", periods=3653, freq="D")
        x = np.arange(len(dates))
        self.prices = pd.DataFrame({
            "Bitcoin": 100 * (1.0008 ** x) * (1 + 0.04 * np.sin(x / 25)),
            "Ethereum": 70 * (1.0010 ** x) * (1 + 0.06 * np.sin(x / 30 + 1)),
            "Solana": np.where(x < 250, np.nan, 8 * (1.0013 ** x) * (1 + 0.08 * np.sin(x / 22 + 2))),
        }, index=dates)

    def test_frequency_and_minimum_hold(self):
        result = run_constrained_backtest(self.prices, "A: 90-day momentum",
            rebalance_frequency="Weekly", minimum_holding_days=14)
        trades = next(iter(result.trades.values()))
        if len(trades) > 1:
            gaps = trades["Signal date"].diff().dropna().dt.days
            self.assertTrue((gaps >= 14).all())

    def test_fees_do_not_increase_final_value(self):
        free = run_constrained_backtest(self.prices, "A: 90-day momentum", fee_bps_per_switch=0)
        fee = run_constrained_backtest(self.prices, "A: 90-day momentum", fee_bps_per_switch=50)
        self.assertLessEqual(
            fee.summary.iloc[0]["Final value (USD)"],
            free.summary.iloc[0]["Final value (USD)"] + 1e-8
        )

    def test_walk_forward_has_three_periods(self):
        result = walk_forward_report(self.prices, "C: 30/90/180-day momentum")
        self.assertEqual(list(result["Period"]), ["Development", "Validation", "Test"])


if __name__ == "__main__":
    unittest.main()
