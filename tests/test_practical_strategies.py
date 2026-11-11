import unittest
import numpy as np
import pandas as pd

from strategy_engine import run_practical_strategies


class PracticalStrategyTests(unittest.TestCase):
    def setUp(self):
        dates = pd.date_range("2020-01-01", periods=500, freq="D")
        # Deterministic synthetic trends, with SOL beginning later.
        btc = 100 * (1.001 ** np.arange(500))
        eth = 80 * (1.0015 ** np.arange(500))
        sol = 10 * (1.003 ** np.arange(500))
        sol[:220] = np.nan
        self.prices = pd.DataFrame(
            {"Bitcoin": btc, "Ethereum": eth, "Solana": sol},
            index=dates
        )

    def test_returns_all_three_strategies(self):
        result = run_practical_strategies(self.prices, 1000)
        names = set(result.summary["Strategy"])
        self.assertIn("A: 90-day momentum", names)
        self.assertIn("B: 50/200-day trend + momentum", names)
        self.assertIn("C: 30/90/180-day momentum", names)

    def test_no_future_holding_signal(self):
        result = run_practical_strategies(self.prices, 1000)
        # The first applied holding is Bitcoin and all held assets are valid names.
        for holdings in result.holdings.values():
            self.assertEqual(holdings.iloc[0], "Bitcoin")
            self.assertTrue(set(holdings.unique()).issubset({"Bitcoin", "Ethereum", "Solana"}))

    def test_costs_do_not_improve_result(self):
        free = run_practical_strategies(self.prices, 1000, fee_bps_per_switch=0)
        costly = run_practical_strategies(self.prices, 1000, fee_bps_per_switch=25)
        a = free.summary.set_index("Strategy")["Final value (USD)"]
        b = costly.summary.set_index("Strategy")["Final value (USD)"]
        for strategy in a.index:
            self.assertLessEqual(b[strategy], a[strategy] + 1e-8)


if __name__ == "__main__":
    unittest.main()
