# Phase 0 Report — Repository Audit and Migration Planning

## 1. Phase Identification
- **Phase Name**: Repository Audit and Migration Planning
- **Phase Number**: Phase 0
- **Branch**: `v2.0-nextjs-migration`
- **Date**: `2026-11-11`

## 2. Objective
Audit the entire Crypto Wealth Maximizer v1.0 repository, map all application capabilities to their exact Python calculation engine functions, inspect data loading paths and runtime dependencies, execute all baseline automated tests and validation scripts, create the `v2.0-nextjs-migration` branch, and establish the `docs/migration/` project tracking structure without modifying any existing v1.0 functionality.

## 3. Work Completed
1. Inspected all 34 tracked files on `main` (`6b1a6f9`) including `app.py`, `crypto_engine.py`, `strategy_engine.py`, `optimization_engine.py`, `robustness_engine.py`, `validate_data.py`, `validate_optimizer.py`, `requirements.txt`, `.gitignore`, `data/crypto_daily_prices.csv`, `practical_strategy_baseline.csv`, all 8 unit test modules in `tests/`, and all v1.0 phase/research markdown documents.
2. Mapped every UI section (`app.py` Sections 1–11 and sidebar configuration) to its exact Python engine functions, parameters, default values, outputs, and CSV exports in `docs/migration/MASTER_MIGRATION_PLAN.md`.
3. Audited data loading (`DATA_DIR = Path("data")`, `PRICE_FILE`, `download_prices()`, `load_prices()`, `clean_prices()`) and confirmed dataset properties (`3,653` rows from `2016-11-09` through `2026-11-09`, `Solana` valid from `2020-04-10` with `1,248` earlier `NaN` rows).
4. Executed the entire baseline `unittest` suite (`26/26` passed), `validate_data.py` (`PASS`), and `validate_optimizer.py` (`0..10` max switches `PASS`).
5. Reconciled live engine outputs directly against `FINAL_RESEARCH_REPORT.md` and `practical_strategy_baseline.csv` — confirmed exact numerical agreement.
6. Audited local environment and package compatibility (`Python 3.13.9`, `pandas 3.1.1`, `numpy 2.5.4`, `Node v24.14.1`, `npm 11.11.0`) and documented all compatibility, performance, serialization, and data-slicing risks in `docs/migration/KNOWN_ISSUES.md`.
7. Created branch `v2.0-nextjs-migration` from `main` (`6b1a6f9`) and prepared the full migration documentation suite under `docs/migration/`.

## 4. Files Created
- `docs/migration/MASTER_MIGRATION_PLAN.md`
- `docs/migration/PROJECT_STATUS.md`
- `docs/migration/CURRENT_PHASE.md`
- `docs/migration/TEST_RESULTS.md`
- `docs/migration/KNOWN_ISSUES.md`
- `docs/migration/NEXT_ACTIONS.md`
- `docs/migration/PHASE_00_REPORT.md` (this file)

## 5. Files Modified
- None (zero existing files modified).

## 6. Files Intentionally Left Unchanged
All existing v1.0 files remain completely unchanged on `v2.0-nextjs-migration`:
- `app.py`
- `crypto_engine.py`, `strategy_engine.py`, `optimization_engine.py`, `robustness_engine.py`
- `validate_data.py`, `validate_optimizer.py`
- `data/crypto_daily_prices.csv`, `data/.gitkeep`, `practical_strategy_baseline.csv`
- `tests/` (all 8 test files, 26 tests)
- `requirements.txt`, `.gitignore`
- `README.md`, `DATA_SOURCES.md`, `FINAL_RESEARCH_REPORT.md`, `RELEASE_NOTES_V1.0.md`, `Crypto_Wealth_Maximizer_Final_Research_Report.md`, `Crypto_Wealth_Maximizer_v1.0_Release_Notes.md`, and all `PHASE*.md` documents.

## 7. Architecture Decisions
1. **Preserve v1.0 Files Untouched**: Keep `app.py` and root `requirements.txt` intact so Streamlit v1.0 remains runnable as a live regression oracle.
2. **Backend Dependency Isolation**: Place FastAPI/Pydantic/HTTPX dependencies in `backend/requirements.txt` (Phase 1) rather than mutating root `requirements.txt`.
3. **Project-Root Dataset Resolution without Engine Mutation**: Rather than modifying `crypto_engine.py`'s `Path("data")` constants (which would affect v1.0 relative-path expectations), Phase 1 will implement `backend/core/data_loader.py` to resolve `<repo_root>/data/crypto_daily_prices.csv` robustly and pass the cleaned DataFrame directly into engine functions.
4. **Threadpool + Deterministic Caching without Algorithm Rewrites**: Preserve exact loop behavior in `optimization_engine.py` and `crypto_engine.py` (Rule 6), mitigating synchronous runtime latency (`~1.5–2s` per constrained backtest, `~8–10s` per 4-mode comparison, `~15–20s` per sensitivity grid) using FastAPI threadpool endpoints and deterministic in-memory caching for static CSV requests.
5. **Strict JSON Sanitization**: Convert all `NaN`/`+/-Inf` outputs (pre-launch SOL, warm-up indicators, Benchmark `"Lifetime max drawdown (%)"`) to `None` (`null`) at the API boundary.

## 8. API Endpoints Implemented
- None implemented in Phase 0 (planning phase only).
- Target Phase 1 API contracts are mapped in `docs/migration/MASTER_MIGRATION_PLAN.md` and `docs/migration/NEXT_ACTIONS.md` (`GET /api/health`, `GET /api/markets/prices`, `GET /api/markets/summary`, `POST /api/backtest/compare`, `POST /api/backtest/run`, `POST /api/risk/protection`, `POST /api/robustness/analyze`, `GET /api/reports/summary`).

## 9. Tests Executed & Actual Test Results
All checks ran on `2026-11-11` using the project virtual environment (`.\venv\Scripts\python.exe`, `Python 3.13.9`, `pandas 3.1.1`, `numpy 2.5.4`):

| Check | Result | Details |
|---|---|---|
| `.\venv\Scripts\python.exe -m unittest discover -s tests -v` | **PASS (`26 / 26`)** | `71.734s`, `OK` across all 8 test files |
| `.\venv\Scripts\python.exe validate_data.py` | **PASS (exit 0)** | `3,653` rows (`2016-11-09` to `2026-11-09`); `0` duplicates; `0` non-positive; SOL starts `2020-04-10` (`2,405` valid, `1,248` missing) |
| `.\venv\Scripts\python.exe validate_optimizer.py` | **PASS (exit 0)** | Caps `0..10` all `PASS`, exact path and curve reconstruction match |
| Baseline engine reconciliation (`compare_protection_modes`, `walk_forward_report`, `protection_effectiveness`, `run_practical_strategies`) | **PASS (100% parity)** | Immediate BTC Combined Protection = `$585,970.46`, CAGR `81.89%`, Max DD `-69.94%`, Sharpe `1.21`, Switches `95`, Cash days `1,830`; Wait-for-signal Walk-Forward Test = `$938.60`, CAGR `-21.74%`, Sharpe `-0.46`; Wait drawdown exits = `39` (mean `-24.07%`, worst `-40.26%`) |

Full per-test breakdown is recorded in `docs/migration/TEST_RESULTS.md`.

## 10. Commands Executed
```powershell
git status
git branch -a
git remote -v
git log -n 10 --oneline
git ls-files
python --version
.\venv\Scripts\python.exe --version
node --version
npm --version
.\venv\Scripts\python.exe -m pip list
.\venv\Scripts\python.exe -m unittest discover -s tests -v
.\venv\Scripts\python.exe validate_data.py
.\venv\Scripts\python.exe validate_optimizer.py
.\venv\Scripts\python.exe -c "..."   # Reference output reconciliation against FINAL_RESEARCH_REPORT.md & practical_strategy_baseline.csv
git checkout -b v2.0-nextjs-migration
```

## 11. Known Issues & Risks
Logged in `docs/migration/KNOWN_ISSUES.md` (`KI-001` through `KI-011`). Key items:
- **`KI-001` / `KI-002`**: CWD-relative `Path("data")` and bare top-level imports in existing engines require root-path resolution in Phase 1 `backend/`.
- **`KI-003`**: `NaN` values (SOL pre-2020-04-10, benchmark lifetime drawdown, warm-up indicators) require strict JSON `null` sanitization.
- **`KI-004`**: Simulation loops (`~8–10s` for `compare_protection_modes`, `~15–20s` for `parameter_sensitivity`) require threadpool + deterministic caching in Phase 1.
- **`KI-005`**: `fastapi`, `pydantic`, and `httpx` must be added for `backend/` in Phase 1 without disturbing root `requirements.txt`.
- **`KI-006` / `KI-008`**: Reviewer confirmation requested on sub-range `indicator_history` warm-up behavior and excluding live `yfinance` write-refresh / arbitrary CSV upload from Phase 1 API endpoints.
- **`KI-007`**: Explained historical documentation shift between `PHASE4_2_RELEASE_NOTES.md` (`$469,759`) and `FINAL_RESEARCH_REPORT.md` (`$585,970.46`) due to Phase 4.3 initialization updates.

## 12. Visual / Output Evidence
Phase 0 contains no UI changes. Verified quantitative reconciliation outputs:
- Immediate BTC Combined Protection: `$585,970.46` (`39,492.60%` total return, `81.89%` CAGR, `-69.94%` max DD, `68.43%` vol, `1.21` Sharpe, `95` switches, `1,830` cash days) — identical to `FINAL_RESEARCH_REPORT.md`.
- Wait-for-signal Walk-Forward Test Period: `$938.60` (`-21.74%` CAGR, `-52.02%` max DD, `-0.46` Sharpe, `12` switches, `381` cash days) — identical to `FINAL_RESEARCH_REPORT.md`.
- Practical Strategies (`0 bps`): Bitcoin `$152,438.67`, Strategy A `$5,217,235.09` (`180` switches), Strategy B `$3,020,332.37` (`103` switches), Strategy C `$739,680.03` (`113` switches) — identical to `practical_strategy_baseline.csv`.

## 13. Commit SHA
- **Base `main` commit SHA**: `6b1a6f9e227e06d9b02b657ac16b67d3af6c6108` (`6b1a6f9`)
- **Phase 0 migration docs commit SHA**: `f0273ee870e85e4c5ae887b1445f6f32c36a139d` (`f0273ee`)
- **Phase 0 report commit SHA**: Recorded as the subsequent tip commit on `v2.0-nextjs-migration` (`git log -1` and delivered in the push report; a commit's own SHA cannot be embedded inside a file tracked by that same commit).

## 14. Acceptance Criteria Checklist
- [x] Repository audit completed across all source, data, test, and documentation files.
- [x] Existing 26 automated tests executed and verified passing (`26/26`).
- [x] Existing validation scripts (`validate_data.py`, `validate_optimizer.py`) executed and passing.
- [x] No existing v1.0 application functionality modified.
- [x] Migration branch `v2.0-nextjs-migration` created from `main`.
- [x] `docs/migration/MASTER_MIGRATION_PLAN.md`, `PROJECT_STATUS.md`, `CURRENT_PHASE.md`, `TEST_RESULTS.md`, `KNOWN_ISSUES.md`, `NEXT_ACTIONS.md`, and `PHASE_00_REPORT.md` completed and grounded in actual code.

## 15. Recommended Next Steps
1. Review this Phase 0 report, `MASTER_MIGRATION_PLAN.md`, and `KNOWN_ISSUES.md` on GitHub (`v2.0-nextjs-migration`).
2. Confirm the open design items listed in `docs/migration/NEXT_ACTIONS.md` (canonical read-only CSV vs upload/refresh, sub-range `indicator_history` handling, backend test runner preference, endpoint granularity for practical strategies & hindsight optimizer).
3. Update `docs/migration/NEXT_ACTIONS.md` (or provide approval) to authorize starting **Phase 1 — Python Backend and FastAPI Foundation**.
