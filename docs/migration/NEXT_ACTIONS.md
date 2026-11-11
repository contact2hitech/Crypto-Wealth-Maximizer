# Next Actions — Phase 0 Review Gate & Phase 1 Preparation

## Authoritative Gate Status
- **Status**: `AWAITING_EXTERNAL_REVIEW`
- **Current Phase Completed**: Phase 0 (Repository Audit & Migration Planning)
- **Next Phase**: Phase 1 (Python Backend and FastAPI Foundation)
- **Instruction**: Do **not** begin Phase 1 code implementation until GitHub review feedback is posted in this file (or explicit user approval is received to proceed with Phase 1).

---

## Proposed Phase 1 Scope (Subject to Reviewer Confirmation)

When approved to proceed to Phase 1, execute the following tasks on branch `v2.0-nextjs-migration`:

1. **Create `backend/` layout**:
   - `backend/main.py`
   - `backend/core/config.py` (project-root path resolution, CORS origin configuration via env vars, `sys.path` wiring for root engines)
   - `backend/core/data_loader.py` (loads `<repo_root>/data/crypto_daily_prices.csv`, runs data-quality validation without mutating or forward-filling missing SOL prices)
   - `backend/core/serialization.py` (`NaN`/`Inf` -> `None`, `Timestamp`/`date` -> ISO-8601)
   - `backend/schemas/` (Pydantic v2 request & response models)
   - `backend/services/` (thin adapters invoking `crypto_engine.py`, `strategy_engine.py`, `optimization_engine.py`, `robustness_engine.py` with deterministic caching)
   - `backend/api/` (`health.py`, `markets.py`, `backtests.py`, `risk.py`, `robustness.py`, `reports.py`)
   - `backend/tests/` (FastAPI `TestClient` + v1.0 regression parity tests)
   - `backend/requirements.txt` (keep root `requirements.txt` untouched for v1.0 Streamlit compatibility)

2. **Implement Phase 1 Endpoints**:
   - `GET /api/health`
   - `GET /api/markets/prices`
   - `GET /api/markets/summary`
   - `POST /api/backtest/compare`
   - `POST /api/backtest/run`
   - `POST /api/risk/protection`
   - `POST /api/robustness/analyze`
   - `GET /api/reports/summary`
   *(Plus any practical strategy / perfect-hindsight optimizer / CSV export endpoints mapped cleanly in Phase 1.)*

3. **Verification Gate for Phase 1**:
   - FastAPI starts cleanly (`uvicorn backend.main:app`).
   - All new backend API & regression parity tests pass.
   - Existing 26 `unittest` tests (`.\venv\Scripts\python.exe -m unittest discover -s tests -v`) continue to pass (`26/26`).
   - Zero duplicate datasets, zero secrets committed, v1.0 `streamlit run app.py` preserved.

---

## Open Decisions for External Review (from `KNOWN_ISSUES.md`)

1. **`KI-008` (CSV Upload & Live `yfinance` Refresh)**: Confirm that v2.0 backend should read exclusively from the validated canonical `data/crypto_daily_prices.csv` (without exposing server-side `yfinance` write-refresh or arbitrary CSV upload in Phase 1).
2. **`KI-006` (Sub-range Warm-up)**: When a user filters `start_date > 2016-11-09` in Strategy Lab, should `/api/backtest/run` preserve `app.py`'s global slice behavior (`indicator_history=None`) for strict v1.0 parity, or pass full pre-start history as `indicator_history` (or expose an explicit toggle)?
3. **Test Runner Preference**: Confirm whether `backend/tests/` should use `unittest` (matching the existing `tests/` suite) or `pytest` alongside `unittest` for the existing 26 tests.
4. **Endpoint Granularity for Practical Strategies & Hindsight Optimizer**: Confirm whether `POST /api/backtest/compare` / `POST /api/backtest/run` should expose practical strategies (`strategy_engine.run_practical_strategies`) and hindsight optimizer (`crypto_engine.optimal_switching`, explicitly flagged `is_hindsight_upper_bound=True`) via dedicated fields/sub-routes or combined payload modes.
