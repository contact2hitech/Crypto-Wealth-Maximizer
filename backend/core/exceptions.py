"""Structured domain exceptions mapped to safe HTTP error responses."""

from __future__ import annotations

from typing import Any, Optional


class BackendError(Exception):
    """Base application exception that never exposes internal stack traces."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int = 400,
        error_code: str = "BAD_REQUEST",
        details: Optional[dict[str, Any]] = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        self.details = details or {}


class DataUnavailableError(BackendError):
    """Raised when the canonical historical price dataset cannot be loaded or validated."""

    def __init__(self, message: str, *, details: Optional[dict[str, Any]] = None) -> None:
        super().__init__(
            message,
            status_code=503,
            error_code="DATASET_UNAVAILABLE",
            details=details,
        )


class InvalidDateRangeError(BackendError):
    """Raised when a requested date slice is invalid or contains insufficient observations."""

    def __init__(self, message: str, *, details: Optional[dict[str, Any]] = None) -> None:
        super().__init__(
            message,
            status_code=422,
            error_code="INVALID_DATE_RANGE",
            details=details,
        )


class EngineValidationError(BackendError):
    """Raised when an existing Python calculation engine rejects input constraints."""

    def __init__(self, message: str, *, details: Optional[dict[str, Any]] = None) -> None:
        super().__init__(
            message,
            status_code=422,
            error_code="ENGINE_VALIDATION_ERROR",
            details=details,
        )

