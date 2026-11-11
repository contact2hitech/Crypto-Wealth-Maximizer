"""Schemas for the /api/health endpoint."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class DatasetHealthInfo(BaseModel):
    """Summary of the canonical dataset loaded by the backend."""

    path_relative: str
    row_count: int
    duplicate_dates: int
    start_date: str
    end_date: str
    assets_available: list[str]
    missing_pre_launch_sol_days: int
    last_modified_utc: str
    valid: bool


class HealthResponse(BaseModel):
    """Health check response summarizing service and canonical dataset status."""

    status: Literal["ok", "degraded"]
    service: str
    version: str
    app_env: str
    engine_source_of_truth: Literal["python"] = "python"
    python_version: str
    timestamp_utc: str
    dataset: DatasetHealthInfo

