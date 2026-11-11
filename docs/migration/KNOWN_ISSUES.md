# Known Issues, Risks, and Open Questions

This file tracks technical issues, architectural constraints, dataset caveats, and open design questions discovered during the migration.

---

## Resolved in Phase 1

### `KI-001` — Working-directory-dependent dataset path in `crypto_engine.py` *(Resolved in Backend)*
- **Resolution**: `backend/core/config.py` and `backend/core/data_loader.py` resolve `<repo_root>/data/crypto_daily_prices.csv` via `Path(__file__).resolve()`, passing defensive DataFrame copies to engine functions without modifying `crypto_engine.py`. Verified working from both repo root and `backend/` CWD.

### `KI-002` — Bare top-level module imports across engines *(Resolved in Backend)*
- **Resolution**: `backend/__init__.py`, `backend/core/config.py`, and `backend/main.py` insert `REPO_ROOT` onto `sys.path` before engine imports.

### `KI-003` — `NaN` / `Infinity` values in engine DataFrames break strict JSON serialization *(Resolved in Backend)*
- **Resolution**: `backend/core/serialization.py` converts all `NaN`/`+/-Inf` values to `None` (`null`) and dates to ISO-8601. Verified across all API tests using `json.dumps(..., allow_nan=False)`.

### `KI-005` — Backend FastAPI dependencies not yet installed in `venv` *(Resolved in Phase 1)*
- **Resolution**: Added `backend/requirements.txt` (`fastapi`, `pydantic`, `uvicorn`, `httpx`, `pandas`, `numpy`) while preserving root `requirements.txt` untouched for v1.0 Streamlit compatibility. Installed `fastapi 0.162.4`, `pydantic 2.14.3`, `httpx 0.28.1` into `venv`.

### `KI-006` — Date-range filtering vs indicator warm-up and walk-forward boundaries *(Resolved per Review Decision)*
- **Resolution**: Confirmed and implemented in Phase 1: `/api/backtest/run` and related endpoints slice `[start_date, end_date]` before calling engines (`indicator_history=None`, `warmup_mode="evaluation_window_only"`), matching `app.py` v1.0 parity; `walk_forward_report` inside `/api/robustness/analyze` ignores dashboard date filters and runs on the full canonical dataset with fixed Development/Validation/Test splits.

### `KI-008` — Optional CSV upload and live `yfinance` refresh in v1.0 sidebar *(Resolved per Review Decision)*
- **Resolution**: Excluded CSV upload and server-side `yfinance` refresh endpoints from the v2.0 backend; verified via OpenAPI schema test (`test_no_csv_upload_or_yfinance_refresh_routes_exposed`).

### `KI-010` — Engine Coupling Quirks in `app.py` *(Resolved in Backend Schemas)*
- **Resolution**: `ProtectionCompareRow.lifetime_max_drawdown_pct` is `Optional[float]` (`None` for Benchmark rows), and `RobustnessAnalyzeRequest` exposes explicit `enable_cash_filter`, `enable_drawdown_protection`, and optional `walk_forward_cash_filter`.

---

## Active Technical Notes & Future-Phase Considerations

### `KI-004` — Cold simulation latency & warm serialization payload sizes *(Partially Mitigated in Phase 1)*
- **Phase 1 Mitigation**: CPU-bound routes execute as synchronous `def` handlers on FastAPI's AnyIO worker threadpool and use thread-safe `BoundedResponseCache` (`OrderedDict` + `RLock`, returning `model_copy(deep=True)`).
- **Measured Cold / Warm Benchmarks**:
  - `POST /api/robustness/analyze` (with 9-run sensitivity grid): `19.31s` cold / `7.3 ms` warm (`23.3 KB`).
  - `POST /api/backtest/compare` (full curves + details): `13.92s` cold / `796.5 ms` warm (`3.82 MB`).
  - `POST /api/backtest/practical`: `10.87s` cold / `225.7 ms` warm (`1.58 MB`).
  - `POST /api/backtest/run`: `3.21s` cold / `170.3 ms` warm (`1.29 MB`).
  - `POST /api/risk/protection`: `3.28s` cold / `147.4 ms` warm (`2.59 MB`).
- **Phase 2–4 Impact**:
  1. Frontend `fetch()` timeouts in `lib/api/` must allow at least `60s` (`60,000 ms`) so cold Strategy Lab / Robustness requests never time out prematurely, and UI pages must show clear non-blocking loading states.
  2. When rendering `/api/backtest/compare` on charts without needing full daily holdings/trace details, pass `include_details=false` or consider enabling FastAPI `GZipMiddleware` in a later optimization pass to reduce `1–3.8 MB` JSON wire payloads.

### `KI-012` — Starlette `TestClient` / `httpx` deprecation warning in test logs
- **Observed**: `fastapi 0.162.4` / `starlette 1.10.0` emits `StarletteDeprecationWarning: Using httpx with starlette.testclient is deprecated; install httpx2 instead.` during unit test execution.
- **Impact**: Informational warning only; all 21 backend tests and live Uvicorn HTTP requests run cleanly. Monitor Starlette/FastAPI upgrades if upgrading `requirements` later.

### `KI-007` — Historical discrepancy in `PHASE4_2_RELEASE_NOTES.md` vs `FINAL_RESEARCH_REPORT.md` *(Documented Historical Context)*
- **Status**: Explained in Phase 0 (`PHASE4_2_RELEASE_NOTES.md` predated Phase 4.3 initialization fixes); Phase 1 API tests verify 100% numeric parity with `FINAL_RESEARCH_REPORT.md` (`$585,970.46` Immediate BTC, `$470,228.77` Wait-for-signal).

### `KI-009` — Duplicate Markdown report files and local untracked `trades_*.csv`
- **Status**: Retained untouched in root for v1.0 compatibility (`FINAL_RESEARCH_REPORT.md`, `RELEASE_NOTES_V1.0.md`, and their `Crypto_Wealth_Maximizer_*` copies).

### `KI-011` — Dataset Source Caveats
- **Notes**: `Solana` starts `2020-04-10` (`1,248` earlier `null` values preserved); `Ethereum` pre-`2017-11-09` series caveat remains surfaced via `/api/markets/prices`, `/api/markets/summary`, and `/api/reports/summary`.
