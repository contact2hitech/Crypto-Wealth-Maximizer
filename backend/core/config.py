"""Project-root resolution and environment-driven settings for the FastAPI backend."""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_DIR.parent
DEFAULT_DATA_FILE = REPO_ROOT / "data" / "crypto_daily_prices.csv"
DEFAULT_DEV_ORIGINS = ("http://localhost:3000", "http://127.0.0.1:3000")

# Ensure root v1.0 calculation engines (crypto_engine, strategy_engine, etc.)
# and package imports (backend.*) resolve regardless of working directory.
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


def _parse_cors_origins(raw: str | None, app_env: str) -> tuple[str, ...]:
    if raw is None or not raw.strip():
        return DEFAULT_DEV_ORIGINS if app_env != "production" else ()
    origins = tuple(item.strip() for item in raw.split(",") if item.strip())
    if app_env == "production" and "*" in origins:
        raise ValueError("Wildcard CORS origin '*' is not permitted in production.")
    return tuple(origin for origin in origins if origin != "*") if app_env == "production" else origins


@dataclass(frozen=True)
class Settings:
    """Immutable runtime settings for the backend application."""

    app_name: str
    app_version: str
    app_env: str
    repo_root: Path
    data_file_path: Path
    cors_origins: tuple[str, ...]
    cache_size: int


def get_settings() -> Settings:
    """Load runtime configuration from environment variables with safe defaults."""
    app_env = os.getenv("APP_ENV", "development").strip().lower() or "development"
    raw_data_file = os.getenv("CRYPTO_DATA_FILE", "").strip()
    if raw_data_file:
        candidate = Path(raw_data_file)
        data_file_path = candidate if candidate.is_absolute() else (REPO_ROOT / candidate).resolve()
    else:
        data_file_path = DEFAULT_DATA_FILE

    raw_cache_size = os.getenv("BACKEND_CACHE_SIZE", "64").strip()
    try:
        cache_size = max(1, min(256, int(raw_cache_size)))
    except ValueError:
        cache_size = 64

    return Settings(
        app_name="Crypto Wealth Maximizer API",
        app_version="2.0.0-alpha.1",
        app_env=app_env,
        repo_root=REPO_ROOT,
        data_file_path=data_file_path,
        cors_origins=_parse_cors_origins(os.getenv("CORS_ORIGINS"), app_env),
        cache_size=cache_size,
    )

