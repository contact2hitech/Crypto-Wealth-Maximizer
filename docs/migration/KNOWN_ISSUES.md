# Known Issues, Risks, and Open Questions

This file tracks technical issues, architectural constraints, dataset caveats, and open design questions discovered during the migration.

---

## Active Technical Notes & Optimization Backlog

### `KI-004` — Cold simulation latency & warm serialization payload sizes *(Mitigated in Phases 1–3)*
- **Phase 1 Mitigation**: CPU-bound routes execute synchronously on FastAPI's worker threadpool (`def` routes) and use thread-safe `BoundedResponseCache` (`OrderedDict` + `RLock`, returning `model_copy(deep=True)`).
- **Phase 2 Mitigation**: Frontend `apiClient` sets `60_000 ms` standard timeouts and `90_000 ms` timeouts for heavy simulation endpoints, shares a single `ApiHealthProvider` context across all 6 routes, and provides non-blocking `LoadingState` indicators.
- **Phase 3 Mitigation**:
  - Dashboard requests `include_daily_trace: false` on `POST /api/backtest/run` to avoid transferring ~1.3 MB of unused 17-column trace rows.
  - Charts use `downsampleByExtrema(..., 450, ...)` strictly for SVG rendering while preserving endpoints, Solana's `2020-04-10` onset, and exact min/max extrema (`-69.94%`). KPIs and tables render exact backend summary values.
  - `DataTable` paginates large tables (`pageSize={10}` on Switching History, `pageSize={12}` on Crossovers).
- **Phase 4–6 Backlog**: Evaluate FastAPI `GZipMiddleware` in Phase 5/6 optimization review for `1–3.8 MB` payloads (`compare_protection_modes`, `daily_drawdown_execution_trace`).

### `KI-013` — Backend response cache bounded by entry count, not memory byte size *(Review Note from Phase 2)*
- **Observation**: `BoundedResponseCache` (`backend/services/cache.py`) caps entries by count (`BACKEND_CACHE_SIZE`, default `64`, max `256`), not total RAM consumed.
- **Planned Optimization Review**: Measure memory footprint under multi-parameter workloads in Phase 5/6 and consider lowering default `BACKEND_CACHE_SIZE` or adding byte-weight estimation without introducing Redis.

### `KI-015` — Chart Downsampling Multi-Series Extrema Resolution & `allowImportingTsExtensions`
- **Phase 3 Resolution**: `downsampleByExtrema` in `frontend/lib/charts/downsample.ts` was corrected to track minimum and maximum indices independently for every series in every bucket. This prevents cross-series scale occlusion (e.g., Bitcoin price ~$70k or strategy wealth ~$500k occluding Solana price ~$20 or drawdown percentages -69%). The `maxPoints` budget (default 450) is enforced under normal conditions, while mandatory endpoint and series-onset boundaries are preserved even when their count exceeds the requested budget as an intentional mandatory-boundary overflow exception.
- **Node Test Note**: `frontend/tsconfig.json` enables `"allowImportingTsExtensions": true` with `"noEmit": true` so Node 24 native `node --test` can import `.ts` modules with full type checking.

### `KI-016` — Dashboard / Markets `useEffect` Strict Mode Fetch Behavior
- **Observation**: In development (`reactStrictMode: true`), Dashboard (`POST /api/backtest/run`) and Markets (`GET /api/markets/prices`) run effect setup → cleanup abort → setup remount using per-effect `AbortController`. In production (`next build` / `next start`), Strict Mode does not double-invoke effects, and FastAPI's `BoundedResponseCache` makes repeat queries fast (`~166–170 ms` warm).

### `KI-012` — Starlette `TestClient` / `httpx` deprecation warning in test logs
- **Observed**: Informational warning only in Python `TestClient` runs; all 21 backend tests pass.

### `KI-007` — Historical discrepancy in `PHASE4_2_RELEASE_NOTES.md` vs `FINAL_RESEARCH_REPORT.md`
- **Status**: Explained in Phase 0; Phase 1 parity tests and Phase 3 Dashboard reconciliation confirm exact agreement with `FINAL_RESEARCH_REPORT.md`.

### `KI-009` — Duplicate Markdown report files and local untracked `trades_*.csv`
- **Status**: Retained untouched in root for v1.0 compatibility.

### `KI-011` — Dataset Source Caveats
- **Notes**: `Solana` starts `2020-04-10` (`1,248` earlier `null` values preserved with `connectNulls={false}`); `Ethereum` pre-`2017-11-09` series caveat remains surfaced prominently on `/markets` and `/reports`.

---

## Resolved Issues
- `KI-014` *(Resolved in Phase 2)*: Interactive headless Edge Playwright verification active and used across Phases 2–3.
- `KI-001`..`KI-003`, `KI-005`, `KI-006`, `KI-008`, `KI-010`: Resolved in Phase 1.
