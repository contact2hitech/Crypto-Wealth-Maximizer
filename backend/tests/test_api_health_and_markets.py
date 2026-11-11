"""Tests for /api/health, /api/markets/prices, /api/markets/summary, and data loader safety."""

from __future__ import annotations

import json
import os
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from backend.core.config import BACKEND_DIR
from backend.core.data_loader import get_dataset_snapshot
from backend.main import create_app
from backend.services.cache import response_cache


class HealthAndMarketsApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        response_cache.clear()
        cls.client = TestClient(create_app())

    def test_health_endpoint_returns_canonical_dataset_status(self) -> None:
        resp = self.client.get("/api/health")
        self.assertEqual(resp.status_code, 200)
        payload = resp.json()
        self.assertEqual(payload["status"], "ok")
        self.assertEqual(payload["engine_source_of_truth"], "python")
        ds = payload["dataset"]
        self.assertEqual(ds["path_relative"], "data/crypto_daily_prices.csv")
        self.assertEqual(ds["row_count"], 3653)
        self.assertEqual(ds["duplicate_dates"], 0)
        self.assertEqual(ds["start_date"], "2016-11-09")
        self.assertEqual(ds["end_date"], "2026-11-09")
        self.assertEqual(ds["assets_available"], ["Bitcoin", "Ethereum", "Solana"])
        self.assertEqual(ds["missing_pre_launch_sol_days"], 1248)
        self.assertTrue(ds["valid"])

    def test_markets_prices_preserves_missing_sol_and_strict_json(self) -> None:
        resp = self.client.get("/api/markets/prices")
        self.assertEqual(resp.status_code, 200)
        payload = resp.json()
        # Verify zero NaN / Infinity tokens exist anywhere in serialized payload.
        json.dumps(payload, allow_nan=False)

        self.assertEqual(payload["date_range"]["row_count"], 3653)
        self.assertEqual(payload["common_start_date"], "2020-04-10")
        self.assertEqual(len(payload["prices"]), 3653)
        self.assertIsNone(payload["prices"][0]["Solana"])

        sol_launch = next(row for row in payload["prices"] if row["date"] == "2020-04-10")
        self.assertIsNotNone(sol_launch["Solana"])
        self.assertGreater(sol_launch["Solana"], 0)

        bh_by_asset = {row["asset"]: row for row in payload["buy_and_hold"]}
        self.assertAlmostEqual(bh_by_asset["Bitcoin"]["final_value_usd"], 152438.67, places=2)
        self.assertEqual(bh_by_asset["Solana"]["entry_date"], "2020-04-10")
        self.assertGreater(len(payload["crossovers"]), 0)

    def test_markets_prices_custom_date_range_and_invalid_ranges(self) -> None:
        resp = self.client.get(
            "/api/markets/prices",
            params={"start_date": "2020-04-10", "end_date": "2020-05-10", "initial_capital": 1000},
        )
        self.assertEqual(resp.status_code, 200)
        payload = resp.json()
        self.assertEqual(payload["date_range"]["row_count"], 31)
        self.assertEqual(payload["common_start_date"], "2020-04-10")
        self.assertEqual(payload["initial_capital"], 1000.0)

        bad_order = self.client.get(
            "/api/markets/prices",
            params={"start_date": "2025-01-10", "end_date": "2025-01-01"},
        )
        self.assertEqual(bad_order.status_code, 422)
        self.assertEqual(bad_order.json()["error"]["code"], "INVALID_DATE_RANGE")

        empty_slice = self.client.get(
            "/api/markets/prices",
            params={"start_date": "2030-01-01", "end_date": "2030-01-10"},
        )
        self.assertEqual(empty_slice.status_code, 422)
        self.assertEqual(empty_slice.json()["error"]["code"], "INVALID_DATE_RANGE")

    def test_markets_summary_matches_validate_data_audit(self) -> None:
        resp = self.client.get("/api/markets/summary")
        self.assertEqual(resp.status_code, 200)
        payload = resp.json()
        self.assertEqual(payload["data_quality_status"], "valid")
        self.assertEqual(payload["duplicate_dates"], 0)
        self.assertEqual(payload["latest_closes"]["as_of_date"], "2026-11-09")
        self.assertAlmostEqual(payload["latest_closes"]["Bitcoin"], 74496.46875, places=4)

        quality = {row["asset"]: row for row in payload["asset_quality"]}
        self.assertEqual(quality["Bitcoin"]["valid_observations"], 3653)
        self.assertEqual(quality["Bitcoin"]["missing_observations"], 0)
        self.assertEqual(quality["Ethereum"]["valid_observations"], 3653)
        self.assertEqual(quality["Solana"]["first_available_date"], "2020-04-10")
        self.assertEqual(quality["Solana"]["valid_observations"], 2405)
        self.assertEqual(quality["Solana"]["missing_observations"], 1248)

    def test_dataset_snapshot_is_defensively_copied_and_cwd_independent(self) -> None:
        old_cwd = Path.cwd()
        try:
            os.chdir(BACKEND_DIR)
            snap1 = get_dataset_snapshot()
            snap1.prices.iloc[0, 0] = -999.0
            snap2 = get_dataset_snapshot()
            self.assertGreater(float(snap2.prices.iloc[0, 0]), 0.0)
        finally:
            os.chdir(old_cwd)

    def test_missing_dataset_returns_503_without_traceback(self) -> None:
        prev = os.environ.get("CRYPTO_DATA_FILE")
        try:
            os.environ["CRYPTO_DATA_FILE"] = "data/nonexistent_missing_file.csv"
            local_client = TestClient(create_app())
            resp = local_client.get("/api/health")
            self.assertEqual(resp.status_code, 503)
            body = resp.json()
            self.assertEqual(body["error"]["code"], "DATASET_UNAVAILABLE")
            self.assertNotIn("Traceback", resp.text)
        finally:
            if prev is None:
                os.environ.pop("CRYPTO_DATA_FILE", None)
            else:
                os.environ["CRYPTO_DATA_FILE"] = prev

    def test_bounded_cache_returns_isolated_copies_and_respects_eviction(self) -> None:
        from backend.schemas.common import DateRangeInfo
        from backend.services.cache import BoundedResponseCache

        cache = BoundedResponseCache()
        prev = os.environ.get("BACKEND_CACHE_SIZE")
        try:
            os.environ["BACKEND_CACHE_SIZE"] = "2"
            a1 = cache.get_or_compute(
                ("k1",),
                lambda: DateRangeInfo(start_date="2020-01-01", end_date="2020-01-02", row_count=2),
            )
            a1.row_count = 999
            a2 = cache.get_or_compute(
                ("k1",),
                lambda: DateRangeInfo(start_date="2020-01-01", end_date="2020-01-02", row_count=99),
            )
            self.assertEqual(a2.row_count, 2)

            cache.get_or_compute(
                ("k2",),
                lambda: DateRangeInfo(start_date="2020-01-01", end_date="2020-01-03", row_count=3),
            )
            cache.get_or_compute(
                ("k3",),
                lambda: DateRangeInfo(start_date="2020-01-01", end_date="2020-01-04", row_count=4),
            )
            self.assertEqual(cache.size(), 2)
        finally:
            if prev is None:
                os.environ.pop("BACKEND_CACHE_SIZE", None)
            else:
                os.environ["BACKEND_CACHE_SIZE"] = prev


if __name__ == "__main__":
    unittest.main()

