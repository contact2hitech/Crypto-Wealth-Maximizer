"""Tests for /api/backtest/* endpoints and exact numerical parity with v1.0 engines."""

from __future__ import annotations

import json
import unittest

from fastapi.testclient import TestClient

from backend.core.data_loader import get_dataset_snapshot, slice_prices
from backend.main import create_app
from backend.services.cache import response_cache
from optimization_engine import run_constrained_backtest


class BacktestsAndParityApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        response_cache.clear()
        cls.client = TestClient(create_app())

    def test_constrained_backtest_matches_v1_reference_report_exact(self) -> None:
        # Reference configuration from FINAL_RESEARCH_REPORT.md
        resp = self.client.post(
            "/api/backtest/run",
            json={
                "strategy": "A: 90-day momentum",
                "initial_capital": 1480.0,
                "start_date": "2016-11-09",
                "end_date": "2026-11-10",
                "rebalance_frequency": "Monthly",
                "minimum_holding_days": 30,
                "switching_threshold_pct": 10.0,
                "fee_bps_per_switch": 10.0,
                "allow_cash": True,
                "enable_cash_filter": True,
                "enable_drawdown_protection": True,
                "drawdown_protection_pct": 20.0,
                "cash_reentry_score_pct": 0.0,
                "initialization_mode": "Invest immediately in Bitcoin",
                "include_benchmarks": True,
                "include_daily_trace": False,
            },
        )
        self.assertEqual(resp.status_code, 200)
        payload = resp.json()
        json.dumps(payload, allow_nan=False)

        self.assertEqual(payload["workflow"], "constrained_backtest")
        self.assertEqual(payload["warmup_mode"], "evaluation_window_only")
        summary = payload["summary"]
        self.assertAlmostEqual(summary["final_value_usd"], 585970.46, places=2)
        self.assertAlmostEqual(summary["total_return_pct"], 39492.60, places=2)
        self.assertAlmostEqual(summary["cagr_pct"], 81.89, places=2)
        self.assertAlmostEqual(summary["maximum_drawdown_pct"], -69.94, places=2)
        self.assertAlmostEqual(summary["annualized_volatility_pct"], 68.43, places=2)
        self.assertAlmostEqual(summary["sharpe_rf0"], 1.21, places=2)
        self.assertEqual(summary["switches"], 95)
        self.assertEqual(summary["cash_days"], 1830)
        self.assertEqual(len(payload["equity_curve"]), 3653)
        self.assertEqual(payload["equity_curve"][0]["holding"], "Bitcoin")
        self.assertEqual(len(payload["benchmark_summaries"]), 3)
        self.assertIsNone(payload["drawdown_trace"])

    def test_wait_for_signal_initialization_and_subrange_evaluation_parity(self) -> None:
        wait_resp = self.client.post(
            "/api/backtest/run",
            json={
                "initialization_mode": "Wait for first valid signal",
                "include_benchmarks": False,
            },
        )
        self.assertEqual(wait_resp.status_code, 200)
        wait_payload = wait_resp.json()
        self.assertEqual(wait_payload["equity_curve"][0]["holding"], "USD Cash")

        snap = get_dataset_snapshot()
        direct_wait = run_constrained_backtest(
            snap.prices,
            strategy="A: 90-day momentum",
            initial_capital=1480.0,
            start_date="2016-11-09",
            end_date="2026-11-10",
            rebalance_frequency="Monthly",
            minimum_holding_days=30,
            switching_threshold_pct=10.0,
            fee_bps_per_switch=10.0,
            allow_cash=True,
            cash_when_no_positive_score=True,
            drawdown_protection_pct=20.0,
            cash_reentry_score_pct=0.0,
            indicator_history=None,
            initialization_mode="Wait for first valid signal",
        )
        self.assertAlmostEqual(
            wait_payload["summary"]["final_value_usd"],
            float(direct_wait.summary.iloc[0]["Final value (USD)"]),
            places=6,
        )
        self.assertAlmostEqual(wait_payload["summary"]["final_value_usd"], 470228.77, places=2)
        self.assertEqual(wait_payload["summary"]["switches"], 94)
        self.assertEqual(wait_payload["summary"]["cash_days"], 1888)

        # Verify KI-006 parity: subrange run uses sliced DataFrame with indicator_history=None.
        sub_resp = self.client.post(
            "/api/backtest/run",
            json={
                "start_date": "2025-01-01",
                "end_date": "2026-11-09",
                "include_benchmarks": False,
            },
        )
        self.assertEqual(sub_resp.status_code, 200)
        sliced = slice_prices(
            snap.prices,
            start_date=__import__("datetime").date(2025, 1, 1),
            end_date=__import__("datetime").date(2026, 11, 9),
        )
        direct = run_constrained_backtest(
            sliced,
            strategy="A: 90-day momentum",
            initial_capital=1480.0,
            start_date="2025-01-01",
            end_date="2026-11-09",
            rebalance_frequency="Monthly",
            minimum_holding_days=30,
            switching_threshold_pct=10.0,
            fee_bps_per_switch=10.0,
            allow_cash=True,
            cash_when_no_positive_score=True,
            drawdown_protection_pct=20.0,
            cash_reentry_score_pct=0.0,
            indicator_history=None,
            initialization_mode="Invest immediately in Bitcoin",
        )
        self.assertAlmostEqual(
            sub_resp.json()["summary"]["final_value_usd"],
            float(direct.summary.iloc[0]["Final value (USD)"]),
            places=6,
        )

    def test_compare_protection_modes_returns_four_modes_and_three_benchmarks(self) -> None:
        resp = self.client.post(
            "/api/backtest/compare",
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
                "initialization_mode": "Invest immediately in Bitcoin",
                "include_curves": True,
                "include_details": False,
            },
        )
        self.assertEqual(resp.status_code, 200)
        payload = resp.json()
        json.dumps(payload, allow_nan=False)

        self.assertEqual(payload["workflow"], "protection_mode_comparison")
        self.assertEqual(len(payload["comparison"]), 7)
        by_exp = {row["experiment"]: row for row in payload["comparison"]}
        self.assertAlmostEqual(
            by_exp["C – Combined protection"]["final_value_usd"], 585970.46, places=2
        )
        self.assertAlmostEqual(
            by_exp["A – Cash filter only"]["final_value_usd"], 2668905.12, places=2
        )
        self.assertIsNone(by_exp["Benchmark – Bitcoin"]["lifetime_max_drawdown_pct"])
        self.assertEqual(len(payload["curves"]), 7)

    def test_practical_strategies_reconciles_with_baseline_csv(self) -> None:
        resp = self.client.post(
            "/api/backtest/practical",
            json={
                "initial_capital": 1480.0,
                "start_date": "2016-11-09",
                "end_date": "2026-11-10",
                "fee_bps_per_switch": 0.0,
            },
        )
        self.assertEqual(resp.status_code, 200)
        payload = resp.json()
        json.dumps(payload, allow_nan=False)

        self.assertEqual(payload["workflow"], "practical_strategies")
        by_name = {row["strategy"]: row for row in payload["summary"]}
        self.assertAlmostEqual(by_name["Buy & hold: Bitcoin"]["final_value_usd"], 152438.67, places=2)
        self.assertAlmostEqual(by_name["A: 90-day momentum"]["final_value_usd"], 5217235.09, places=2)
        self.assertEqual(by_name["A: 90-day momentum"]["switches"], 180)
        self.assertAlmostEqual(
            by_name["B: 50/200-day trend + momentum"]["final_value_usd"], 3020332.37, places=2
        )
        self.assertEqual(by_name["B: 50/200-day trend + momentum"]["switches"], 103)
        self.assertAlmostEqual(
            by_name["C: 30/90/180-day momentum"]["final_value_usd"], 739680.03, places=2
        )
        self.assertEqual(by_name["C: 30/90/180-day momentum"]["switches"], 113)

        short_resp = self.client.post(
            "/api/backtest/practical",
            json={"start_date": "2026-06-01", "end_date": "2026-11-09"},
        )
        self.assertEqual(short_resp.status_code, 422)
        self.assertEqual(short_resp.json()["error"]["code"], "ENGINE_VALIDATION_ERROR")

    def test_hindsight_optimizer_marks_upper_bound_and_matches_validation(self) -> None:
        resp = self.client.post(
            "/api/backtest/hindsight",
            json={
                "initial_capital": 1480.0,
                "start_date": "2016-11-09",
                "end_date": "2026-11-10",
                "max_switches": 5,
            },
        )
        self.assertEqual(resp.status_code, 200)
        payload = resp.json()
        json.dumps(payload, allow_nan=False)

        self.assertEqual(payload["workflow"], "perfect_hindsight_optimizer")
        self.assertTrue(payload["is_hindsight_upper_bound"])
        self.assertFalse(payload["is_investable"])
        self.assertIn("future prices", payload["warning"].lower())

        by_cap = {row["maximum_switches"]: row for row in payload["summary"]}
        self.assertAlmostEqual(by_cap[0]["final_value_usd"], 152438.67, places=2)
        self.assertAlmostEqual(by_cap[5]["final_value_usd"], 552814299.71, places=2)
        self.assertEqual(len(payload["paths"]["5"]), 5)


if __name__ == "__main__":
    unittest.main()

