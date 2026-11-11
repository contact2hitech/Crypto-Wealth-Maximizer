"""JSON-safe serialization helpers converting NaN/Infinity to None and dates to ISO-8601."""

from __future__ import annotations

import datetime
import math
from typing import Any, Optional

import numpy as np
import pandas as pd


def clean_float(value: Any) -> Optional[float]:
    """Return a finite Python float, or None when NaN, Inf, or missing."""
    if value is None or pd.isna(value):
        return None
    numeric = float(value)
    return numeric if math.isfinite(numeric) else None


def clean_int(value: Any) -> Optional[int]:
    """Return a Python int, or None when missing."""
    if value is None or pd.isna(value):
        return None
    return int(value)


def clean_bool(value: Any) -> bool:
    """Convert NumPy or Python booleans cleanly."""
    return bool(value)


def format_date(value: Any) -> Optional[str]:
    """Format Timestamp/date/datetime values as ISO-8601 YYYY-MM-DD strings."""
    if value is None or pd.isna(value):
        return None
    if isinstance(value, pd.Timestamp):
        return value.date().isoformat()
    if isinstance(value, datetime.datetime):
        return value.date().isoformat()
    if isinstance(value, datetime.date):
        return value.isoformat()
    return str(pd.Timestamp(value).date().isoformat())


def sanitize_json_value(value: Any) -> Any:
    """Recursively convert Pandas/NumPy objects and non-finite floats into JSON-safe primitives."""
    if value is None:
        return None
    if isinstance(value, (pd.Timestamp, datetime.datetime, datetime.date)):
        return format_date(value)
    if isinstance(value, (bool, np.bool_)):
        return bool(value)
    if isinstance(value, (int, np.integer)):
        return int(value)
    if isinstance(value, (float, np.floating)):
        numeric = float(value)
        return numeric if math.isfinite(numeric) else None
    if isinstance(value, dict):
        return {str(k): sanitize_json_value(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [sanitize_json_value(item) for item in value]
    if pd.isna(value):
        return None
    return value

