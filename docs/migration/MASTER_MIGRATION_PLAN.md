# Master Migration Plan — Crypto Wealth Maximizer v2.0

## 1. Objective and Scope

Migrate **Crypto Wealth Maximizer** from a single-file Streamlit application (`v1.0`, `app.py`) to a decoupled, production-structured web application (`v2.0`) built with:
- **Backend**: Python + FastAPI + Pydantic v2 + existing v1.0 financial calculation engines (`crypto_engine.py`, `strategy_engine.py`, `optimization_engine.py`, `robustness_engine.py`).
- **Frontend**: Next.js (App Router) + React + TypeScript + Tailwind CSS + shadcn/ui + Recharts (and Plotly.js only where justified) + Lucide icons.
- **Data**: Canonical historical CSV dataset at `data/crypto_daily_prices.csv` (no database, no duplicate dataset, no synthetic backfilling of missing pre-launch SOL prices).
- **Branching**: All migration development occurs exclusively on `v2.0-nextjs-migration`. `main` remains untouched until explicit user approval.

### Non-Negotiable Principles
1. **Python Engines Are the Source of Truth**: Financial calculations must never be reimplemented independently in TypeScript/JavaScript.
2. **Preserve v1.0 Integrity**: `app.py`, the four Python engines, `data/crypto_daily_prices.csv`, `validate_*.py`, existing reports, and all 26 existing unit tests must remain intact and passing.
3. **Strict Research Honesty**: Keep negative out-of-sample Test-period findings prominent, label the dynamic-programming optimizer as non-investable perfect hindsight, clearly explain daily-close drawdown execution vs intraday stop-losses, and preserve transaction-cost/friction disclosures.
4. **Scope Discipline**: No live trading, exchange connectivity, AI forecasting, user authentication, subscriptions, databases, or microservices.

---

## 2. Repository Audit & Feature-to-Module Mapping

### 2.1 Existing Source Inventory (Base Commit `6b1a6f9`)
| File | Lines | Role | Migration Disposition |
|---|---:|---|---|
| `app.py` | 427 | Streamlit v1.0 UI (Sections 1–11) | Retained intact as v1.0 reference |
| `crypto_engine.py` | 292 | Price loading/cleaning, normalized & common-start indices, crossovers, buy-and-hold, DP optimal switching, max drawdown | Reused directly by FastAPI backend (via safe path wrapper) |
| `strategy_engine.py` | 164 | Practical strategies A/B/C without lookahead + summary metrics | Reused directly by FastAPI backend |
| `optimization_engine.py` | 272 | Constrained backtest (cash filter, daily DD stop, re-entry, init modes, daily trace), benchmarks, 4-mode protection comparison, walk-forward | Reused directly by FastAPI backend |
| `robustness_engine.py` | 88 | Causal BTC market regimes, regime performance, asset exposure attribution, protection exit overshoot, sensitivity grid | Reused directly by FastAPI backend |
| `validate_data.py` | 36 | CLI dataset quality audit | Retained intact |
| `validate_optimizer.py` | 47 | CLI DP optimizer path-reconstruction audit | Retained intact |
| `tests/*.py` (8 files) | 421 | 26 `unittest` tests covering all 4 engines | Retained intact & executed in every phase |
| `data/crypto_daily_prices.csv` | 3,654 | Historical daily USD closes (`2016-11-09` to `2026-11-09`) | Single canonical dataset loaded via project-root path |

### 2.2 Detailed Feature Mapping (`app.py` -> Python Engines)

| v1.0 UI Section | UI Controls / Defaults | Engine Function(s) | Outputs & Exports |
|---|---|---|---|
| **Sidebar Settings** | `initial_capital=1480.0`, `start_date=2016-11-09`, `end_date=2026-11-10`, `switch_cap=5` (`[0,1,2,3,5,10]`), CSV upload, refresh button | `load_prices()`, `clean_prices()` | Filtered `prices` DataFrame; latest close metrics for BTC/ETH/SOL |
| **Sec 1: Historical Prices** | Date range | `clean_prices()` | Daily close series for Bitcoin, Ethereum, Solana |
| **Sec 2: Normalized Performance** | Date range | `normalized_indices(prices)` | Index = 100 on each asset's own first valid date |
| **Sec 3: Common-Start Comparison** | Date range | `common_start_indices(prices)` | Index = 100 on first date all 3 assets exist (`2020-04-10`) |
| **Sec 4: Crossovers** | Date range | `find_crossovers(prices)` | Table of relative index sign changes (`Date`, `Pair`, `Leader after crossover`, `Index spread after crossover`) |
| **Sec 5: Buy & Hold** | `capital`, `start` | `buy_and_hold(prices, capital, start)` (+ `run_benchmark` in Sec 9) | Entry date, last price date, final value, profit, return (%) |
| **Sec 6: Perfect-Hindsight Optimizer** | `capital`, `switch_cap`, `start`, `chosen_cap` | `optimal_switching(prices, capital, switch_cap, start)`, `max_drawdown(curve)` | Summary table (caps `0..K`), switch path, equity curve, max drawdown (explicitly non-investable) |
| **Sec 7: Data Quality** | Date range | `prices[a].first_valid_index()`, `last_valid_index()`, `notna().sum()`, `isna().sum()` | Quality summary table + `crypto_daily_prices.csv` download |
| **Sec 8: Practical Strategies** | `fee_bps` (`0..100` step `5`, default `0`) | `run_practical_strategies(prices, capital, start, end, fee_bps)` | Summary (`Buy & hold: Bitcoin`, Strategy A/B/C), equity curves, holdings, trades (`practical_strategy_switches.csv`) |
| **Sec 9: Risk & Protection Lab (Config)** | `strategy` (`A/B/C`, def `A`), `freq` (`Daily/Weekly/Every 15 days/Monthly`, def `Monthly`), `min_hold` (`0/7/14/30/60`, def `30`), `threshold` (`0/1/3/5/10/15/20`, def `10.0`), `fee_bps` (`0/5/10/25/50/100`, def `10`), `dd_pct` (`5/10/15/20/25/30/40`, def `20`), `reentry_pct` (`-5/0/2/5/10`, def `0`), `init_mode` (`Invest immediately in Bitcoin` / `Wait for first valid signal`, def immediate) | — | Passed to 9A, 9B, 9C, and Sec 10 |
| **Sec 9A: 4 Protection Modes + Trace** | Selected mode (`A/B/C/D`) | `compare_protection_modes(...)` | 4 protection modes + 3 benchmarks summary, equity curves, underwater drawdown curves, diagnostics (`risk_event_diagnostics.csv`), switches (`protection_mode_switches.csv`), holdings (`daily_holding_history.csv`), daily drawdown trace (`daily_drawdown_execution_trace.csv`) |
| **Sec 9B: Individual Risk Controls** | `single_cash_filter=True`, `single_dd=True` | `run_constrained_backtest(...)` | Single-configuration summary, curves, holdings, trades, diagnostics, trace |
| **Sec 9C: Walk-Forward Validation** | Uses `single_cash_filter` + Sec 9 config | `walk_forward_report(...)` | Independent Development (`2016-11-09`–`2022-12-31`), Validation (`2023-01-01`–`2024-12-31`), Test (`2025-01-01`–`2026-11-09`) rows (`walk_forward_results.csv`) |
| **Sec 10: Robustness Investigation** | Always uses Combined Protection (`cash_filter=True`, `dd=dd_protection`) | `regime_performance()`, `asset_attribution()`, `protection_effectiveness()`, `parameter_sensitivity()` | Regime table (`market_regime_analysis.csv`), asset exposure (`asset_attribution.csv`), protection exit overshoot (`protection_exit_analysis.csv`), 3x3 sensitivity grid (`parameter_sensitivity.csv`) |
| **Sec 11: Reports & Downloads** | — | Reads `FINAL_RESEARCH_REPORT.md` & `RELEASE_NOTES_V1.0.md` | Research overview + Markdown file downloads |

---

## 3. Target v2.0 Architecture

### 3.1 Directory Layout
```text
Crypto_Wealth_Maximizer_v1.0/
├── app.py, crypto_engine.py, strategy_engine.py, optimization_engine.py, robustness_engine.py  # Unchanged v1.0 core
├── data/crypto_daily_prices.csv                                                                 # Single canonical dataset
├── tests/                                                                                       # Existing 26 unit tests
├── backend/
│   ├── main.py                  # FastAPI app, lifespan data load, CORS, exception handlers
│   ├── core/
│   │   ├── config.py            # Project root resolution, env vars, CORS origins
│   │   ├── data_loader.py       # Safe canonical CSV loader & data quality validation
│   │   └── serialization.py     # NaN/Inf -> None, Timestamp/Date -> ISO-8601 helpers
│   ├── schemas/                 # Strict Pydantic v2 request/response models
│   ├── services/                # Thin wrappers calling existing Python engines (+ deterministic cache)
│   ├── api/                     # health, markets, backtests, risk, robustness, reports routers
│   ├── tests/                   # FastAPI TestClient & regression comparison tests
│   └── requirements.txt         # FastAPI/Pydantic/HTTPX additions (separate from v1.0 requirements.txt)
├── frontend/
│   ├── app/                     # Next.js App Router: /, /dashboard, /markets, /strategy-lab, /risk-lab, /robustness, /reports
│   ├── components/              # layout/, dashboard/, charts/, common/, forms/, tables/
│   ├── lib/                     # api/, formatters/, constants/, utils/
│   ├── hooks/
│   ├── types/
│   └── package.json
└── docs/migration/              # Authoritative migration tracking & phase reports
```

### 3.2 Initial API Surface (Backed Strictly by Existing Engines)
- `GET /api/health` — API health, Python/engine readiness, dataset path status, dataset date coverage (`2016-11-09` to `2026-11-09`), row count (`3,653`).
- `GET /api/markets/prices` — Historical closes, normalized indices, common-start indices, crossovers, buy-and-hold summary (optional date range query params).
- `GET /api/markets/summary` — Latest close cards, asset availability start/end dates, valid/missing counts, data quality audit status.
- `POST /api/backtest/compare` — `compare_protection_modes` (4 protection modes + 3 benchmarks) + optional practical strategies / perfect-hindsight optimizer comparison.
- `POST /api/backtest/run` — `run_constrained_backtest` (single configuration) and/or `run_practical_strategies` + `optimal_switching` (clearly separated & labelled).
- `POST /api/risk/protection` — Constrained risk metrics, daily drawdown execution trace, protection event summary, exit overshoot diagnostics (`protection_effectiveness`).
- `POST /api/robustness/analyze` — `walk_forward_report`, `regime_performance`, `asset_attribution`, `parameter_sensitivity`.
- `GET /api/reports/summary` (plus structured export/download endpoints for research report, release notes, and CSV exports).

*(Exact route query/body structures and whether practical strategies / optimizer get dedicated or parameterized routes will be finalized cleanly in Phase 1.)*

---

## 4. Phased Implementation Roadmap & Acceptance Gates

| Phase | Name | Primary Deliverables | Critical Acceptance Gate |
|---|---|---|---|
| **0** | Repository Audit & Migration Planning | `v2.0-nextjs-migration` branch; `docs/migration/*`; baseline test & reconciliation verification | 26/26 existing tests pass; zero v1.0 code altered; Phase 0 docs pushed & reviewed via `NEXT_ACTIONS.md` |
| **1** | Python Backend & FastAPI Foundation | `backend/` app, schemas, services, dataset loader, CORS, error handling, backend API tests | FastAPI starts; `/api/health`, `/api/markets/*`, `/api/backtest/*`, `/api/risk/*`, `/api/robustness/*`, `/api/reports/*` pass tests; 26 existing tests pass; numbers reconcile 100% with v1.0 |
| **2** | Next.js Frontend Foundation | `frontend/` Next.js + TS + Tailwind + shadcn/ui dark theme, top nav, 6 routes, typed API client, health indicator | App starts; all 6 routes load cleanly on desktop & mobile; zero mock financial data; lint/typecheck pass |
| **3** | Dashboard & Markets Integration | Live `/dashboard` and `/markets` wired to FastAPI, equity/drawdown/price/normalized/common-start charts, date filters, quality table | All numbers match backend; pre-launch SOL remains missing; loading/error/empty states verified |
| **4** | Strategy Lab, Risk Lab & Robustness | Interactive `/strategy-lab`, `/risk-lab`, `/robustness` wired to backend, validation, trace/exit tables, sensitivity/regime/attribution/walk-forward | All configurations pass through to Python engines; outputs reconcile identically with v1.0; negative Test results & disclaimers clearly displayed |
| **5** | Reports, QA & Release Preparation | `/reports`, Markdown & CSV downloads with config metadata, full regression suite, lint/typecheck/prod build, deployment docs, v2.0 release notes | All backend + frontend + 26 legacy tests pass; `next build` succeeds; zero secrets committed |
| **6** | Final Technical Audit & v2.0 Handover | Architecture/security/math/UI audit, startup & deployment commands, complete file inventory, final migration report | All critical defects resolved; ready for explicit user approval before any `main` merge |

---

## 5. Dependency & Compatibility Strategy

- **Keep root `requirements.txt` untouched** (`streamlit>=1.38`, `pandas>=2.2`, `numpy>=1.26`, `yfinance>=0.2.40`, `plotly>=5.23`) so `streamlit run app.py` continues working cleanly.
- **Create `backend/requirements.txt`** adding FastAPI, Pydantic, Uvicorn, HTTPX (and pytest if used) without downgrading `pandas 3.1.1` / `numpy 2.5.4` currently verified in `venv`.
- **Frontend toolchain verified available**: Node.js `v24.14.1` and npm `11.11.0`.
