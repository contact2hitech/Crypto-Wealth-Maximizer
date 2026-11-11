import unittest
import pandas as pd
import numpy as np
from optimization_engine import run_constrained_backtest

class DrawdownTraceTests(unittest.TestCase):
    def setUp(self):
        dates = pd.date_range("2020-01-01", periods=8, freq="D")
        # One sharp close-to-close loss while Bitcoin is held.
        self.prices = pd.DataFrame({
            "Bitcoin": [100, 105, 110, 108, 65, 66, 67, 68],
            "Ethereum": [10, 10, 10, 10, 10, 10, 10, 10],
            "Solana": [5, 5, 5, 5, 5, 5, 5, 5],
        }, index=dates)

    def test_trace_has_one_row_per_day_and_exposes_gap_overshoot(self):
        result = run_constrained_backtest(
            self.prices, "A: 90-day momentum", initial_capital=1000,
            start_date="2020-01-01", end_date="2020-01-08",
            rebalance_frequency="Daily", minimum_holding_days=0,
            switching_threshold_pct=0, fee_bps_per_switch=0,
            allow_cash=True, cash_when_no_positive_score=False,
            drawdown_protection_pct=20,
            initialization_mode="Invest immediately in Bitcoin",
        )
        key = next(iter(result.drawdown_traces))
        trace = result.drawdown_traces[key]
        self.assertEqual(len(trace), len(self.prices))
        self.assertIn("Drawdown trigger breached", trace.columns)
        breached = trace[trace["Drawdown trigger breached"]]
        self.assertGreaterEqual(len(breached), 1)
        self.assertLessEqual(breached.iloc[0]["Drawdown before decision (%)"], -20)
        self.assertEqual(breached.iloc[0]["Execution assumption"],
                         "Signal detected and executed at same daily close")

    def test_compare_exports_trace_for_each_protection_mode(self):
        from optimization_engine import compare_protection_modes
        _, _, _, _, diagnostics = compare_protection_modes(
            self.prices, "A: 90-day momentum", initial_capital=1000,
            start_date="2020-01-01", end_date="2020-01-08",
            rebalance_frequency="Daily", minimum_holding_days=0,
            switching_threshold_pct=0, fee_bps_per_switch=0,
            drawdown_protection_pct=20, cash_reentry_score_pct=0,
        )
        self.assertIn("C – Combined protection – Daily drawdown trace", diagnostics)

if __name__ == "__main__":
    unittest.main()
