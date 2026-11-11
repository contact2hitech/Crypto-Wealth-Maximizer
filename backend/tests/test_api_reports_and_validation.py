"""Tests for /api/reports/*, input validation, CORS security, and error handling."""

from __future__ import annotations

import os
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend.core.config import REPO_ROOT, get_settings
from backend.main import create_app
from backend.services.cache import response_cache


class ReportsValidationAndSecurityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        response_cache.clear()
        cls.client = TestClient(create_app())

    def test_reports_summary_and_markdown_downloads(self) -> None:
        summary_resp = self.client.get("/api/reports/summary")
        self.assertEqual(summary_resp.status_code, 200)
        payload = summary_resp.json()
        self.assertEqual(payload["source_version"], "1.0")
        self.assertEqual(payload["target_version"], "2.0")
        self.assertEqual(len(payload["documents"]), 2)
        self.assertGreaterEqual(len(payload["supported_csv_exports"]), 10)

        rr_resp = self.client.get("/api/reports/download/research-report")
        self.assertEqual(rr_resp.status_code, 200)
        self.assertIn("text/markdown", rr_resp.headers["content-type"])
        self.assertIn("Crypto_Wealth_Maximizer_Final_Research_Report.md", rr_resp.headers["content-disposition"])
        expected_rr = (REPO_ROOT / "FINAL_RESEARCH_REPORT.md").read_text(encoding="utf-8")
        self.assertEqual(rr_resp.text, expected_rr)

        rn_resp = self.client.get("/api/reports/download/release-notes")
        self.assertEqual(rn_resp.status_code, 200)
        expected_rn = (REPO_ROOT / "RELEASE_NOTES_V1.0.md").read_text(encoding="utf-8")
        self.assertEqual(rn_resp.text, expected_rn)

    def test_pydantic_validation_errors_are_structured_without_tracebacks(self) -> None:
        bad_payload = self.client.post(
            "/api/backtest/run",
            json={
                "strategy": "Unknown Strategy",
                "initial_capital": -50,
                "start_date": "2025-01-10",
                "end_date": "2024-01-01",
            },
        )
        self.assertEqual(bad_payload.status_code, 422)
        body = bad_payload.json()
        self.assertEqual(body["error"]["code"], "VALIDATION_ERROR")
        self.assertNotIn("Traceback", bad_payload.text)

        bad_hindsight = self.client.post(
            "/api/backtest/hindsight",
            json={"max_switches": 99},
        )
        self.assertEqual(bad_hindsight.status_code, 422)

    def test_no_csv_upload_or_yfinance_refresh_routes_exposed(self) -> None:
        schema = self.client.get("/openapi.json").json()
        paths = set(schema["paths"].keys())
        for forbidden_substr in ("upload", "refresh", "download_prices", "yfinance"):
            self.assertFalse(
                any(forbidden_substr in p.lower() for p in paths),
                f"Unexpected data mutation route detected: {paths}",
            )

    def test_cors_allows_dev_origin_and_blocks_wildcard_in_production(self) -> None:
        allowed = self.client.get("/api/health", headers={"Origin": "http://localhost:3000"})
        self.assertEqual(allowed.status_code, 200)
        self.assertEqual(allowed.headers.get("access-control-allow-origin"), "http://localhost:3000")

        disallowed = self.client.get("/api/health", headers={"Origin": "https://evil.example.com"})
        self.assertEqual(disallowed.status_code, 200)
        self.assertIsNone(disallowed.headers.get("access-control-allow-origin"))

        with patch.dict(os.environ, {"APP_ENV": "production", "CORS_ORIGINS": "*"}):
            with self.assertRaises(ValueError):
                get_settings()

        with patch.dict(
            os.environ,
            {"APP_ENV": "production", "CORS_ORIGINS": "https://app.example.com"},
        ):
            prod_settings = get_settings()
            self.assertEqual(prod_settings.cors_origins, ("https://app.example.com",))

    def test_unhandled_exception_does_not_leak_stack_trace(self) -> None:
        safe_client = TestClient(create_app(), raise_server_exceptions=False)
        with patch("backend.api.health.get_health_status", side_effect=RuntimeError("sensitive internal path")):
            resp = safe_client.get("/api/health")
        self.assertEqual(resp.status_code, 500)
        body = resp.json()
        self.assertEqual(body["error"]["code"], "INTERNAL_SERVER_ERROR")
        self.assertNotIn("sensitive internal path", resp.text)
        self.assertNotIn("Traceback", resp.text)


if __name__ == "__main__":
    unittest.main()

