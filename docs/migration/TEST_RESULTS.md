# Test Results — Crypto Wealth Maximizer v2.0 Migration

All results below were directly executed and observed in the local environment (`Windows`, `Python 3.13.9` via `.\venv\Scripts\python.exe`, `pandas 3.1.1`, `numpy 2.5.4`, `fastapi 0.162.4`, `pydantic 2.14.3`, `httpx 0.28.1`, `streamlit 1.67.0`) on `2026-11-11`.

---

## Phase 1 Verification (FastAPI Backend & v1.0 Parity)

### 1. Backend API & Regression Parity Test Suite (`unittest` + `TestClient`)
Command:
```powershell
.\venv\Scripts\python.exe -m unittest discover -s backend/tests -v
```
Result: **PASS (`21 / 21` tests in `81.071s`, `OK`)**

Breakdown by module:
- `backend/tests/test_api_health_and_markets.py` — **7 / 7 `ok`**:
  - `test_health_endpoint_returns_canonical_dataset_status`
  - `test_markets_prices_preserves_missing_sol_and_strict_json`
  - `test_markets_prices_custom_date_range_and_invalid_ranges`
  - `test_markets_summary_matches_validate_data_audit`
  - `test_dataset_snapshot_is_defensively_copied_and_cwd_independent`
  - `test_missing_dataset_returns_503_without_traceback`
  - `test_bounded_cache_returns_isolated_copies_and_respects_eviction`
- `backend/tests/test_api_backtests_and_parity.py` — **5 / 5 `ok`**:
  - `test_constrained_backtest_matches_v1_reference_report_exact`
  - `test_wait_for_signal_initialization_and_subrange_evaluation_parity`
  - `test_compare_protection_modes_returns_four_modes_and_three_benchmarks`
  - `test_practical_strategies_reconciles_with_baseline_csv`
  - `test_hindsight_optimizer_marks_upper_bound_and_matches_validation`
- `backend/tests/test_api_risk_and_robustness.py` — **4 / 4 `ok`**:
  - `test_risk_protection_wait_mode_matches_exit_diagnostics`
  - `test_risk_protection_immediate_btc_matches_phase_4_4_1_trace_audit`
  - `test_robustness_walk_forward_uses_full_dataset_and_fixed_periods`
  - `test_robustness_full_sensitivity_grid_returns_nine_combinations`
- `backend/tests/test_api_reports_and_validation.py` — **5 / 5 `ok`**:
  - `test_reports_summary_and_markdown_downloads`
  - `test_pydantic_validation_errors_are_structured_without_tracebacks`
  - `test_no_csv_upload_or_yfinance_refresh_routes_exposed`
  - `test_cors_allows_dev_origin_and_blocks_wildcard_in_production`
  - `test_unhandled_exception_does_not_leak_stack_trace`

### 2. Existing v1.0 Unit Test Suite Re-run (`unittest`)
Command:
```powershell
.\venv\Scripts\python.exe -m unittest discover -s tests -v
```
Result: **PASS (`26 / 26` tests in `53.418s`, `OK`)** — all 8 legacy test modules pass unchanged.

### 3. Live Uvicorn Startup & HTTP Response-Time Benchmark
Server started via `.\venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8011 --log-level warning` and queried twice per endpoint (cold compute vs warm LRU-cached copy) with `httpx`:

| Endpoint | Status (Cold/Warm) | Cold Latency | Warm Latency | Payload Size |
|---|---|---:|---:|---:|
| `GET /api/health` | `200 / 200` | `6.4 ms` | `3.5 ms` | `492 B` |
| `GET /api/markets/summary` | `200 / 200` | `19.2 ms` | `4.3 ms` | `1,283 B` |
| `GET /api/markets/prices` | `200 / 200` | `1,257.6 ms` | `166.6 ms` | `1,093,973 B` |
| `POST /api/backtest/run` | `200 / 200` | `3,213.7 ms` | `170.3 ms` | `1,290,310 B` |
| `POST /api/backtest/compare` | `200 / 200` | `13,923.4 ms` | `796.5 ms` | `3,817,365 B` |
| `POST /api/backtest/practical` | `200 / 200` | `10,872.6 ms` | `225.7 ms` | `1,576,593 B` |
| `POST /api/backtest/hindsight` (`max_switches=5`) | `200 / 200` | `4,919.2 ms` | `223.7 ms` | `1,883,009 B` |
| `POST /api/risk/protection` | `200 / 200` | `3,275.4 ms` | `147.4 ms` | `2,590,546 B` |
| `POST /api/robustness/analyze` (`include_sensitivity=true`) | `200 / 200` | `19,312.0 ms` | `7.3 ms` | `23,343 B` |
| `GET /api/reports/summary` | `200 / 200` | `8.4 ms` | `5.6 ms` | `10,400 B` |

### 4. Working-Directory Independence & Streamlit v1.0 Smoke Check
- `Push-Location backend; ..\venv\Scripts\python.exe -c "import main; ..."` -> `backend_cwd_import: Crypto Wealth Maximizer API 10` (exit 0).
- `.\venv\Scripts\streamlit.exe --version` -> `Streamlit, version 1.67.0` (exit 0).
- `.\venv\Scripts\python.exe -m py_compile app.py crypto_engine.py strategy_engine.py optimization_engine.py robustness_engine.py` -> exit 0.

---

## Phase 0 Baseline Verification (Commit base `6b1a6f9` / branch `v2.0-nextjs-migration`)

### 1. Existing Unit Test Suite (`unittest`)
Command:
```powershell
.\venv\Scripts\python.exe -m unittest discover -s tests -v
```
Result: **PASS (`26 / 26` tests in `71.734s`, `OK`)**

Breakdown by file:
- `tests/test_cash_risk_protection.py` — 4/4 `ok`
- `tests/test_drawdown_trace.py` — 2/2 `ok`
- `tests/test_engine.py` — 3/3 `ok`
- `tests/test_optimization_lab.py` — 3/3 `ok`
- `tests/test_optimizer_exhaustive.py` — 1/1 `ok`
- `tests/test_practical_strategies.py` — 3/3 `ok`
- `tests/test_risk_engine_validation.py` — 7/7 `ok`
- `tests/test_robustness_engine.py` — 3/3 `ok`

### 2. Data Integrity Audit (`validate_data.py`)
Result: **PASS (exit code 0)** — `3,653` rows (`2016-11-09` to `2026-11-09`), `0` duplicate date rows, `0` non-positive prices, `Solana` valid from `2020-04-10` (`2,405` valid, `1,248` missing).

### 3. Perfect-Hindsight Optimizer Audit (`validate_optimizer.py`)
Result: **PASS (exit code 0)** — `0..10` max switches all `PASS`.
