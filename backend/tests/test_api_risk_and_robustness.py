"""Tests for /api/risk/protection and /api/robustness/analyze endpoints."""

from __future__ import annotations

import json
import unittest

from fastapi.testclient import TestClient

from backend.main import create_app
from backend.services.cache import response_cache


class RiskAndRobustnessApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        response_cache.clear()
        cls.client = TestClient(create_app())

    def test_risk_protection_wait_mode_matches_exit_diagnostics(self) -> None:
        resp = self.client.post(
            "/api/risk/protection",
            json={
                "strategy": "A: 90-day momentum",
                "initial_capital": 1480.0,
                "start_date": "2016-11-09",
                "end_date": "2026-11-10",
                "rebalance_frequency": "Monthly",
                "minimum_holding_days": 30,
                "switching_threshold_pct": 10.0,
                "fee_bps_per_switch": 10.0,
                "drawdown_protection_pct": 20.0,
                "cash_reentry_score_pct": 0.0,
                "initialization_mode": "Wait for first valid signal",
                "include_daily_trace": True,
            },
        )
        self.assertEqual(resp.status_code, 200)
        payload = resp.json()
        json.dumps(payload, allow_nan=False)

        exits = payload["exit_metrics"]
        self.assertEqual(exits["total_drawdown_exits"], 39)
        self.assertAlmostEqual(exits["average_exit_drawdown_pct"], -24.07, places=2)
        self.assertAlmostEqual(exits["median_exit_drawdown_pct"], -22.74, places=2)
        self.assertAlmostEqual(exits["worst_exit_drawdown_pct"], -40.26, places=2)
        self.assertEqual(exits["worst_exit_date"], "2020-09-05")
        self.assertEqual(len(payload["daily_trace"]), 3653)
        self.assertIn("not an intraday stop-loss", payload["execution_caveat"].lower())

    def test_risk_protection_immediate_btc_matches_phase_4_4_1_trace_audit(self) -> None:
        resp = self.client.post(
            "/api/risk/protection",
            json={"initialization_mode": "Invest immediately in Bitcoin", "include_daily_trace": True},
        )
        self.assertEqual(resp.status_code, 200)
        trace_by_date = {row["date"]: row for row in resp.json()["daily_trace"]}
        row = trace_by_date["2020-09-05"]
        self.assertEqual(row["holding_during_interval"], "Solana")
        self.assertEqual(row["holding_after_decision"], "USD Cash")
        self.assertTrue(row["drawdown_trigger_breached"])
        self.assertAlmostEqual(row["drawdown_before_decision_pct"], -40.2622, places=3)
        self.assertAlmostEqual(row["close_to_close_portfolio_return_pct"], -26.7325, places=3)

    def test_robustness_walk_forward_uses_full_dataset_and_fixed_periods(self) -> None:
        # Even when dashboard filter starts in 2020-01-01, walk_forward MUST use full canonical dataset.
        resp = self.client.post(
            "/api/robustness/analyze",
            json={
                "strategy": "A: 90-day momentum",
                "initial_capital": 1480.0,
                "start_date": "2020-01-01",
                "end_date": "2026-11-10",
                "rebalance_frequency": "Monthly",
                "minimum_holding_days": 30,
                "switching_threshold_pct": 10.0,
                "fee_bps_per_switch": 10.0,
                "drawdown_protection_pct": 20.0,
                "cash_reentry_score_pct": 0.0,
                "initialization_mode": "Wait for first valid signal",
                "enable_cash_filter": True,
                "enable_drawdown_protection": True,
                "include_sensitivity": False,
            },
        )
        self.assertEqual(resp.status_code, 200)
        payload = resp.json()
        json.dumps(payload, allow_nan=False)

        wf = payload["walk_forward"]
        self.assertTrue(wf["uses_full_canonical_dataset"])
        self.assertTrue(wf["is_independent_periods"])
        periods = {p["period"]: p for p in wf["periods"]}
        self.assertEqual(list(periods.keys()), ["Development", "Validation", "Test"])
        self.assertAlmostEqual(periods["Development"]["final_value_usd"], 223912.42, places=2)
        self.assertAlmostEqual(periods["Validation"]["final_value_usd"], 4900.90, places=2)
        self.assertAlmostEqual(periods["Test"]["final_value_usd"], 938.60, places=2)
        self.assertAlmostEqual(periods["Test"]["cagr_pct"], -21.74, places=2)
        self.assertAlmostEqual(periods["Test"]["sharpe_rf0"], -0.46, places=2)

        total_attr_days = sum(row["days_held"] for row in payload["asset_attribution"])
        self.assertEqual(total_attr_days, payload["evaluation_date_range"]["row_count"])
        total_regime_days = sum(row["days"] for row in payload["market_regimes"])
        self.assertEqual(total_regime_days, payload["evaluation_date_range"]["row_count"])

    def test_robustness_full_sensitivity_grid_returns_nine_combinations(self) -> None:
        resp = self.client.post(
            "/api/robustness/analyze",
            json={
                "start_date": "2016-11-09",
                "end_date": "2026-11-10",
                "initialization_mode": "Wait for first valid signal",
                "include_sensitivity": True,
            },
        )
        self.assertEqual(resp.status_code, 200)
        payload = resp.json()
        json.dumps(payload, allow_nan=False)
        self.assertEqual(len(payload["parameter_sensitivity"]), 9)
        triggers = {row["drawdown_trigger_pct"] for row in payload["parameter_sensitivity"]}
        self.assertEqual(triggers, {10.0, 20.0, 30.0})


if __name__ == "__main__":
    unittest.main()

