# Known Issues, Risks, and Open Questions

This file tracks technical issues, architectural constraints, dataset caveats, and open design questions discovered during the migration.

---

## Active Technical Notes & Optimization Backlog

### `KI-004` — Cold simulation latency & warm serialization payload sizes *(Partially Mitigated in Phases 1–2)*
- **Phase 1 Mitigation**: CPU-bound routes execute synchronously on FastAPI's worker threadpool (`def` routes) and use thread-safe `BoundedResponseCache` (`OrderedDict` + `RLock`, returning `model_copy(deep=True)`).
- **Phase 2 Mitigation**: Frontend `apiClient` sets `60_000 ms` standard timeouts and `90_000 ms` timeouts for heavy simulation endpoints, shares a single `ApiHealthProvider` context across all 6 routes, and provides non-blocking `LoadingState` indicators.
- **Phase 3–5 Guidance**: Use `include_details=false` on comparison charts when daily per-mode holdings/traces aren't needed, paginate large browser tables, and evaluate FastAPI `GZipMiddleware` in a later optimization review.

### `KI-013` — Backend response cache bounded by entry count, not memory byte size *(Review Note from Phase 2)*
- **Observation**: `BoundedResponseCache` (`backend/services/cache.py`) caps entries by count (`BACKEND_CACHE_SIZE`, default `64`, max `256`), not total RAM consumed. Because full-dataset responses hold thousands of nested Pydantic objects per entry, storing up to 64–256 large entries could consume substantial Python process memory on constrained hosts.
- **Planned Optimization Review**: Measure memory footprint under multi-parameter workloads in Phase 5/6 and consider lowering default `BACKEND_CACHE_SIZE` or adding byte-weight estimation without introducing Redis.

### `KI-015` — Offline Detection Poll Latency (`20s` interval) & `allowImportingTsExtensions` Note
- **Observed**: `ApiHealthProvider` uses a `20_000 ms` visibility-aware background poll so slow `next dev` cold route compilation does not trigger mid-navigation polls while still detecting backend shutdown within ~20s without page reload.
- **Note**: `frontend/tsconfig.json` enables `"allowImportingTsExtensions": true` (safe with `"noEmit": true`) so Node 24's native `node --test` runner can import `.ts` modules directly without a separate transpilation step.

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

## Resolved Issues
- `KI-014` *(Resolved in Phase 2 Review Corrections)*: Interactive headless browser verification completed via Playwright + Microsoft Edge across desktop (`1280x800`) and mobile (`390x844`) viewports with visual screenshots inspected.
- `KI-001`..`KI-003`, `KI-005`, `KI-006`, `KI-008`, `KI-010`: Resolved in Phase 1.
