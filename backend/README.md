# Crypto Wealth Maximizer v2.0 — FastAPI Backend

Read-only analytical REST API wrapping the verified v1.0 Python financial calculation engines (`crypto_engine.py`, `strategy_engine.py`, `optimization_engine.py`, `robustness_engine.py`) and the canonical dataset (`data/crypto_daily_prices.csv`).

## Local Setup & Startup

From the repository root (`Crypto_Wealth_Maximizer_v1.0/`):

```powershell
# Using existing project venv (install backend deps once)
.\venv\Scripts\python.exe -m pip install -r backend\requirements.txt

# Start development API server (from repo root)
.\venv\Scripts\python.exe -m uvicorn backend.main:app --reload --port 8000
```

Or from inside `backend/`:

```powershell
..\venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

Interactive OpenAPI docs in development: `http://127.0.0.1:8000/docs`

## Environment Variables

See `backend/.env.example`:
- `APP_ENV`: `development` (default) or `production`.
- `CORS_ORIGINS`: Comma-separated allowed frontend origins. Defaults to `http://localhost:3000,http://127.0.0.1:3000` in development. In `production`, wildcard `*` is rejected; set the deployed Vercel origin explicitly (e.g., `https://your-app.vercel.app`).
- `CRYPTO_DATA_FILE`: Optional dataset path override (defaults to `<repo_root>/data/crypto_daily_prices.csv`).
- `BACKEND_CACHE_SIZE`: Bounded LRU cache entries per process (`1..256`, default `64`).

## API Endpoints

| Method | Path | Engine Source | Notes |
|---|---|---|---|
| `GET` | `/api/health` | `backend.core.data_loader` | Service readiness & canonical CSV audit |
| `GET` | `/api/markets/prices` | `crypto_engine` | Prices, normalized & common-start indices, crossovers, buy & hold |
| `GET` | `/api/markets/summary` | `crypto_engine` + audit checks | Latest closes and per-asset quality metrics |
| `POST` | `/api/backtest/run` | `optimization_engine.run_constrained_backtest` | Evaluation-window indicator warm-up (`indicator_history=None`, v1.0 `app.py` parity) |
| `POST` | `/api/backtest/compare` | `optimization_engine.compare_protection_modes` | 4 protection modes + 3 buy-and-hold benchmarks |
| `POST` | `/api/backtest/practical` | `strategy_engine.run_practical_strategies` | Practical no-lookahead Strategies A, B, and C |
| `POST` | `/api/backtest/hindsight` | `crypto_engine.optimal_switching` | Explicitly marked `is_hindsight_upper_bound: true` (`is_investable: false`) |
| `POST` | `/api/risk/protection` | `optimization_engine` + `robustness_engine` | Protection exits, overshoot metrics, daily drawdown trace |
| `POST` | `/api/robustness/analyze` | `optimization_engine` + `robustness_engine` | Fixed-period walk-forward (full dataset), regimes, attribution, sensitivity grid |
| `GET` | `/api/reports/summary` | `FINAL_RESEARCH_REPORT.md`, `RELEASE_NOTES_V1.0.md` | Report text, reference config, export catalog |
| `GET` | `/api/reports/download/research-report` | `FINAL_RESEARCH_REPORT.md` | Downloadable Markdown attachment |
| `GET` | `/api/reports/download/release-notes` | `RELEASE_NOTES_V1.0.md` | Downloadable Markdown attachment |

## Running Tests

From the repository root:

```powershell
# Existing v1.0 engine tests (26 tests)
.\venv\Scripts\python.exe -m unittest discover -s tests -v

# Backend FastAPI & v1.0 regression parity tests
.\venv\Scripts\python.exe -m unittest discover -s backend/tests -v
```

