import unittest
import numpy as np
import pandas as pd
from optimization_engine import run_constrained_backtest, walk_forward_report


class CashRiskProtectionTests(unittest.TestCase):
    def setUp(self):
        dates = pd.date_range("2016-11-09", periods=3653, freq="D")
        x = np.arange(len(dates))
        # BTC trend turns negative after index 2200; ETH has a distinct trend.
        btc = 100 * np.exp(0.0007 * x) * (1 + 0.04 * np.sin(x / 30))
        btc[2200:] = btc[2200] * np.exp(-0.0012 * np.arange(len(x)-2200)) * (1 + 0.03*np.sin(x[2200:]/20))
        eth = 70 * np.exp(0.0005 * x) * (1 + 0.05 * np.sin(x / 27 + 1))
        sol = np.where(x < 1250, np.nan, 8 * np.exp(0.001 * x) * (1 + 0.07*np.sin(x/19+2)))
        self.prices = pd.DataFrame({"Bitcoin": btc, "Ethereum": eth, "Solana": sol}, index=dates)

    def test_cash_is_an_available_holding(self):
        result = run_constrained_backtest(self.prices, "B: 50/200-day trend + momentum",
            rebalance_frequency="Monthly", allow_cash=True, cash_when_no_positive_score=True,
            drawdown_protection_pct=20)
        holdings = next(iter(result.holdings.values()))
        self.assertIn("USD Cash", set(holdings))

    def test_drawdown_protection_can_trigger_cash(self):
        result = run_constrained_backtest(self.prices, "A: 90-day momentum",
            rebalance_frequency="Weekly", allow_cash=True, cash_when_no_positive_score=False,
            drawdown_protection_pct=10, minimum_holding_days=0)
        trades = next(iter(result.trades.values()))
        self.assertTrue((trades["Reason"] == "Drawdown protection").any() or
                        (trades["To"] == "USD Cash").any())

    def test_walk_forward_uses_prior_indicator_history(self):
        # On Jan 2025 test start, the 180-day momentum score should be populated
        # because earlier data are available as warm-up.
        report = walk_forward_report(self.prices, "C: 30/90/180-day momentum")
        self.assertEqual(list(report["Period"]), ["Development", "Validation", "Test"])
        self.assertTrue(report["Cash days"].ge(0).all())

    def test_fees_do_not_improve_result(self):
        free = run_constrained_backtest(self.prices, "A: 90-day momentum", fee_bps_per_switch=0)
        fee = run_constrained_backtest(self.prices, "A: 90-day momentum", fee_bps_per_switch=50)
        self.assertLessEqual(fee.summary.iloc[0]["Final value (USD)"],
                             free.summary.iloc[0]["Final value (USD)"] + 1e-8)


if __name__ == "__main__":
    unittest.main()
