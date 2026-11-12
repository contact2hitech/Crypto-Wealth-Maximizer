# Known Issues, Risks, and Open Questions

This file tracks technical issues, architectural constraints, dataset caveats, and open design questions discovered during the migration.

---

## Active Technical Notes & Optimization Backlog

### `KI-004` — Cold simulation latency & warm serialization payload sizes *(Partially Mitigated in Phases 1–2)*
- **Phase 1 Mitigation**: CPU-bound routes execute synchronously on FastAPI's worker threadpool (`def` routes) and use thread-safe `BoundedResponseCache` (`OrderedDict` + `RLock`, returning `model_copy(deep=True)`).
- **Phase 2 Mitigation**: Frontend `apiClient` sets `60_000 ms` standard timeouts and `90_000 ms` timeouts for heavy simulation endpoints (`POST /api/backtest/*`, `/api/risk/protection`, `/api/robustness/analyze`), shares a single `ApiHealthProvider` request across all 6 routes to avoid duplicate `/api/health` polling, and provides non-blocking `LoadingState` indicators.
- **Measured Backend Latency (Phase 1)**:
  - `POST /api/robustness/analyze` (with 9-run sensitivity grid): `19.31s` cold / `7.3 ms` warm (`23.3 KB`).
  - `POST /api/backtest/compare` (full curves + details): `13.92s` cold / `796.5 ms` warm (`3.82 MB`).
  - `POST /api/backtest/practical`: `10.87s` cold / `225.7 ms` warm (`1.58 MB`).
  - `POST /api/backtest/run`: `3.21s` cold / `170.3 ms` warm (`1.29 MB`).
  - `POST /api/risk/protection`: `3.28s` cold / `147.4 ms` warm (`2.59 MB`).
- **Phase 3–5 Guidance**: Use `include_details=false` on comparison charts when daily per-mode holdings/traces aren't needed, keep tables paginated/windowed in the browser (do not render 3,653+ DOM table rows unconditionally), and evaluate FastAPI `GZipMiddleware` in a later optimization review.

### `KI-013` — Backend response cache bounded by entry count, not memory byte size *(Review Note from Phase 2)*
- **Observation**: `BoundedResponseCache` (`backend/services/cache.py`) caps entries by count (`BACKEND_CACHE_SIZE`, default `64`, max `256`), not total RAM consumed. Because full-dataset responses (e.g., `/api/backtest/compare` with `include_details=true` or `/api/risk/protection` with 3,653 trace rows) hold thousands of nested Pydantic objects per entry, storing up to 64–256 large entries could consume substantial Python process memory on constrained free-tier FastAPI hosts.
- **Planned Optimization Review**: Measure memory footprint under multi-parameter workloads in Phase 5/6 and consider lowering default `BACKEND_CACHE_SIZE` (e.g., `16–32` in low-RAM containers) or adding byte-weight estimation without introducing Redis.

### `KI-014` — Chrome DevTools MCP unavailable on host for automated browser screenshots
- **Observed (Phase 2)**: `browser` subagent could not connect to Chrome (`DevToolsActivePort` ENOENT on Windows host).
- **Impact**: Live HTTP responses (`307` redirect, `200` on all 6 routes, `dark` root class, nav links, `/api/health` CORS) and Next.js `tsc`/`eslint`/`next build` were directly verified, while interactive Chrome visual inspection & screenshots remain unexecuted until Chrome remote debugging is enabled on the host.

### `KI-012` — Starlette `TestClient` / `httpx` deprecation warning in test logs
- **Observed**: `fastapi 0.162.4` / `starlette 1.10.0` emits `StarletteDeprecationWarning: Using httpx with starlette.testclient is deprecated; install httpx2 instead.` during unit test execution.
- **Impact**: Informational warning only; all 21 backend tests pass.

### `KI-007` — Historical discrepancy in `PHASE4_2_RELEASE_NOTES.md` vs `FINAL_RESEARCH_REPORT.md` *(Documented Historical Context)*
- **Status**: Explained in Phase 0; Phase 1 parity tests confirm exact agreement with `FINAL_RESEARCH_REPORT.md`.

### `KI-009` — Duplicate Markdown report files and local untracked `trades_*.csv`
- **Status**: Retained untouched in root for v1.0 compatibility.

### `KI-011` — Dataset Source Caveats
- **Notes**: `Solana` starts `2020-04-10` (`1,248` earlier `null` values preserved); `Ethereum` pre-`2017-11-09` series caveat remains surfaced via `/api/markets/*`, `/api/reports/summary`, and `/markets` warnings.

---

## Resolved in Phase 1
- `KI-001` (Project-root dataset path resolution in `backend/core/data_loader.py`)
- `KI-002` (Sys.path root wiring in `backend/`)
- `KI-003` (`NaN`/`Infinity` -> `null` JSON sanitization in `backend/core/serialization.py`)
- `KI-005` (`backend/requirements.txt` separated from root `requirements.txt`)
- `KI-006` (`app.py` evaluation-window warm-up parity on `/api/backtest/run` + full canonical dataset for walk-forward)
- `KI-008` (Read-only canonical CSV without upload or live `yfinance` refresh routes)
- `KI-010` (Explicit schema fields for benchmark `lifetime_max_drawdown_pct: null` and robustness flags)
