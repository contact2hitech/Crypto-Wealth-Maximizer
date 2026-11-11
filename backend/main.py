"""FastAPI entrypoint for Crypto Wealth Maximizer v2.0 backend."""

from __future__ import annotations

import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

# Ensure project root is on sys.path whether started via `backend.main:app` or `cd backend && uvicorn main:app`.
_REPO_ROOT = Path(__file__).resolve().parents[1]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from backend.api import backtests, health, markets, reports, risk, robustness  # noqa: E402
from backend.core.config import get_settings  # noqa: E402
from backend.core.data_loader import get_dataset_snapshot  # noqa: E402
from backend.core.exceptions import BackendError  # noqa: E402
from backend.core.serialization import sanitize_json_value  # noqa: E402

logger = logging.getLogger("crypto_wealth_maximizer.api")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Warm canonical dataset snapshot on startup if available without mutating files."""
    try:
        snapshot = get_dataset_snapshot()
        logger.info(
            "Loaded canonical dataset %s (%d rows: %s -> %s)",
            snapshot.metadata.path_relative,
            snapshot.metadata.row_count,
            snapshot.metadata.start_date,
            snapshot.metadata.end_date,
        )
    except BackendError as exc:
        logger.warning("Startup dataset warm check skipped: %s", exc.message)
    yield


def create_app() -> FastAPI:
    """Build and configure the FastAPI application instance."""
    settings = get_settings()
    application = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "Read-only research & backtesting REST API wrapping the verified v1.0 "
            "Python financial calculation engines."
        ),
        lifespan=lifespan,
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "Accept"],
    )

    @application.exception_handler(BackendError)
    async def handle_backend_error(_: Request, exc: BackendError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=sanitize_json_value(
                {
                    "error": {
                        "code": exc.error_code,
                        "message": exc.message,
                        "details": exc.details,
                    }
                }
            ),
        )

    @application.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        fields = [
            {
                "loc": [str(part) for part in err.get("loc", ())],
                "message": str(err.get("msg", "Invalid input")),
                "type": str(err.get("type", "validation_error")),
            }
            for err in exc.errors()
        ]
        return JSONResponse(
            status_code=422,
            content=sanitize_json_value(
                {
                    "error": {
                        "code": "VALIDATION_ERROR",
                        "message": "Request validation failed.",
                        "details": {"fields": fields},
                    }
                }
            ),
        )

    @application.exception_handler(StarletteHTTPException)
    async def handle_http_exception(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=sanitize_json_value(
                {
                    "error": {
                        "code": f"HTTP_{exc.status_code}",
                        "message": str(exc.detail),
                        "details": {},
                    }
                }
            ),
        )

    @application.exception_handler(Exception)
    async def handle_unexpected_error(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled backend exception: %s", type(exc).__name__)
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An unexpected internal server error occurred.",
                    "details": {},
                }
            },
        )

    application.include_router(health.router)
    application.include_router(markets.router)
    application.include_router(backtests.router)
    application.include_router(risk.router)
    application.include_router(robustness.router)
    application.include_router(reports.router)
    return application


app = create_app()

