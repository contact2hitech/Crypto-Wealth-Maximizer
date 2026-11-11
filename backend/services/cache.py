"""Thread-safe bounded LRU cache returning deep copies of immutable responses."""

from __future__ import annotations

import threading
from collections import OrderedDict
from typing import Callable, TypeVar

from pydantic import BaseModel

from backend.core.config import get_settings

T = TypeVar("T", bound=BaseModel)


class BoundedResponseCache:
    """Thread-safe bounded LRU cache for deterministic Pydantic API responses."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._store: OrderedDict[tuple, BaseModel] = OrderedDict()

    def get_or_compute(self, key: tuple, compute_fn: Callable[[], T]) -> T:
        """Return a deep copy of a cached response or compute and store it safely."""
        maxsize = get_settings().cache_size
        with self._lock:
            cached = self._store.get(key)
            if cached is not None:
                self._store.move_to_end(key)
                return cached.model_copy(deep=True)  # type: ignore[return-value]

        result = compute_fn()
        stored_copy = result.model_copy(deep=True)
        with self._lock:
            self._store[key] = stored_copy
            self._store.move_to_end(key)
            while len(self._store) > maxsize:
                self._store.popitem(last=False)
        return result.model_copy(deep=True)  # type: ignore[return-value]

    def clear(self) -> None:
        """Clear all cached entries (intended for isolated unit tests)."""
        with self._lock:
            self._store.clear()

    def size(self) -> int:
        """Return current number of cached items."""
        with self._lock:
            return len(self._store)


response_cache = BoundedResponseCache()

