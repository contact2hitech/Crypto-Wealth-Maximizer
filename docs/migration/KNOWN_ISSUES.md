# Known Issues, Risks, and Open Questions

This file tracks technical issues, architectural constraints, dataset caveats, and open design questions discovered during the migration.

---

## Active Technical Issues & Architectural Constraints

### `KI-001` — Working-directory-dependent dataset path in `crypto_engine.py`
- **Source**: `crypto_engine.py` lines 14–15 (`DATA_DIR = Path("data")`, `PRICE_FILE = DATA_DIR / "crypto_daily_prices.csv"`).
- **Impact**: Calling `download_prices()` / `load_prices()` when `cwd` is not the repository root (for example, running Uvicorn inside `backend/`) fails to find the canonical CSV and could attempt a network call via `yfinance`.
- **Planned Resolution (Phase 1)**: Keep `crypto_engine.py` untouched for v1.0 compatibility; implement a backend project-root-relative dataset loader (`backend/core/data_loader.py`) that reads `<repo_root>/data/crypto_daily_prices.csv` directly (env-overridable via `DATA_FILE_PATH`) and passes the cleaned `DataFrame` to engine functions.

### `KI-002` — Bare top-level module imports across engines
- **Source**: `strategy_engine.py` (`from crypto_engine import ...`), `optimization_engine.py` (`from crypto_engine import ...`), `robustness_engine.py` (`from optimization_engine import ...`).
- **Impact**: Importing engines from `backend/` fails unless the repository root is on `sys.path` / `PYTHONPATH`.
- **Planned Resolution (Phase 1)**: Resolve and insert the repository root path safely in `backend/core/config.py` before importing engine modules.

### `KI-003` — `NaN` / `Infinity` values in engine DataFrames break strict JSON serialization
- **Source**:
  - Pre-launch `Solana` prices (`2016-11-09` through `2020-04-09`, `1,248` rows).
  - Warm-up `NaN` scores / `Insufficient history` indicators.
  - `compare_protection_modes` benchmark rows omit `"Lifetime max drawdown (%)"`, yielding `NaN` in the combined summary DataFrame.
  - Edge-case Sharpe or return metrics when `vol == 0` or `equity` is short.
- **Impact**: Python `json` / FastAPI / Pydantic strict JSON output must not emit `NaN` tokens, which break browser `JSON.parse()` and OpenAPI validation.
- **Planned Resolution (Phase 1)**: Implement centralized sanitization in `backend/core/serialization.py` and Pydantic models converting `NaN`/`+/-Inf` to `None` (`null` in JSON) and timestamps to ISO-8601 date strings.

### `KI-004` — Synchronous latency of Python simulation loops
- **Observed**:
  - `unittest` suite (26 tests) took `71.734s`.
  - `run_constrained_backtest` loops row-by-row over `3,653` dates calling `scores.loc[dt].dropna()` (~1.5–2s per call).
  - `compare_protection_modes` runs 4 constrained backtests (~7–9s); `parameter_sensitivity` runs 9 backtests (~15–20s); `optimal_switching` with `max_switches=10` takes several seconds.
- **Impact**: Blocking the FastAPI async event loop or recomputing identical default parameters on every page load will degrade responsiveness.
- **Planned Resolution (Phase 1)**: Do **not** rewrite the financial algorithms (Rule 6). Instead, use synchronous FastAPI endpoint functions (executed in AnyIO's worker threadpool) combined with deterministic in-memory memoization keyed by immutable simulation inputs against the static dataset.

### `KI-005` — Backend FastAPI dependencies not yet installed in `venv`
- **Observed**: `venv` currently contains `streamlit 1.67.0`, `pandas 3.1.1`, `numpy 2.5.4`, `plotly 7.1.0`, `yfinance 1.8.0`, `starlette 1.10.0`, `uvicorn 0.54.0`, but does **not** have `fastapi`, `pydantic`, or `httpx` (and `pytest` if used).
- **Planned Resolution (Phase 1)**: Add `backend/requirements.txt` without breaking root `requirements.txt`, and install into `venv` (or dedicated environment) during Phase 1 setup.

### `KI-006` — Date-range filtering vs indicator warm-up and walk-forward boundaries
- **Source**: In `app.py` line 45, `prices` is globally sliced to `[start, end]` before all downstream calls. Meanwhile, `optimization_engine.run_constrained_backtest` supports an `indicator_history` argument for warm-up prior to `start_date`, and `walk_forward_report` hardcodes `Development (2016-11-09..2022-12-31)`, `Validation (2023-01-01..2024-12-31)`, and `Test (2025-01-01..2026-11-09)`.
- **Impact**:
  - Slicing `prices` before `walk_forward_report` causes errors if `start_date` excludes Development or Validation rows.
  - Slicing `prices` before `run_constrained_backtest` removes pre-start indicator warm-up unless `indicator_history` is supplied.
- **Open Question / Plan**: For v1.0 regression parity on full-range defaults (`2016-11-09` to `2026-11-10`), `indicator_history` and `prices` are identical. When a user runs a custom sub-range in v2.0 Strategy Lab, clarify whether `indicator_history` should pass full history up to `end_date` (matching `walk_forward_report`) or strictly match `app.py`'s global slice. Default recommendation: document clearly and expose `walk_forward_report` over the full dataset, matching v1.0 defaults.

### `KI-007` — Historical discrepancy in `PHASE4_2_RELEASE_NOTES.md` vs `FINAL_RESEARCH_REPORT.md`
- **Observed**: `PHASE4_2_RELEASE_NOTES.md` reported Combined Protection as `$469,759` and `1,888` cash days, whereas `FINAL_RESEARCH_REPORT.md` reported `$585,970.46` and `1,830` cash days.
- **Explanation**: Phase 4.3 (`PHASE4_3_RELEASE_NOTES.md`) updated missing-indicator handling and added `"Invest immediately in Bitcoin"` vs `"Wait for first valid signal"`. On the current v1.0 engine:
  - Immediate Bitcoin = `$585,970.46` / `1,830` cash days (matches `FINAL_RESEARCH_REPORT.md`).
  - Wait for signal = `$470,228.80` / `1,888` cash days (the Phase 4.2 behavior closely resembles wait-for-signal during initial missing history).
- **Status**: Explained and verified; not a bug.

### `KI-008` — Optional CSV upload and live `yfinance` refresh in v1.0 sidebar
- **Source**: `app.py` lines 26–27 (`uploaded = st.file_uploader(...)`, `refresh = st.button(...)`).
- **Impact**: Allowing unauthenticated web visitors to trigger server-side `yfinance` writes to `data/crypto_daily_prices.csv` or upload arbitrary CSVs poses concurrency, reproducibility, and security risks in a deployed FastAPI service.
- **Open Question**: Should v2.0 read exclusively from the validated canonical `data/crypto_daily_prices.csv` (recommended for Phase 1–5 stability and exact v1.0 reproducibility), or should CSV upload be deferred/excluded? Recorded in `NEXT_ACTIONS.md` for reviewer confirmation.

### `KI-009` — Duplicate Markdown report files and local untracked `trades_*.csv`
- **Observed**:
  - `FINAL_RESEARCH_REPORT.md` and `Crypto_Wealth_Maximizer_Final_Research_Report.md` are byte-identical (`SHA256: 9C12C854...`).
  - `RELEASE_NOTES_V1.0.md` and `Crypto_Wealth_Maximizer_v1.0_Release_Notes.md` are byte-identical (`SHA256: E20E3310...`).
  - `trades_A.csv`, `trades_B.csv`, `trades_C.csv` exist locally in the workspace root (ignored by `.gitignore` `trades_*.csv`).
- **Action**: Retain untouched to preserve v1.0 state.

### `KI-010` — Engine Coupling Quirks in `app.py`
- **Observed**:
  - Section 9C (`walk_forward_report`) reads Section 9B's `single_cash_filter` checkbox (default `True`), whereas Section 10 (`robustness_engine`) always runs Combined Protection (`cash_when_no_positive_score=True` and `drawdown_protection_pct=dd_protection`).
  - `compare_protection_modes` benchmark rows lack `"Lifetime max drawdown (%)"` (`NaN`), unlike modes A–D.
- **Action**: Explicitly represent `cash_filter` and `drawdown_protection` parameters in the Phase 1 Risk/Robustness API contracts with v1.0 defaults so UI state never silently diverges.

### `KI-011` — Dataset Source Caveats
- **Source**: `DATA_SOURCES.md` and `PHASE3_BASELINE_RESULTS.md`.
- **Notes**:
  - `Solana` begins `2020-04-10` (`1,248` earlier observations are intentionally `NaN` and must never be forward-filled or fabricated).
  - `Ethereum` history prior to `2017-11-09` in the bundled dataset reflects a reconciled multi-source series noted as provisional in `DATA_SOURCES.md`.
  - These caveats must remain visible on the v2.0 Markets and Reports views.
