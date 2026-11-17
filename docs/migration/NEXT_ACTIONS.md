# Next Actions — Phase 4 Formal Closure & Phase 5 Readiness

## Authoritative Gate Status
- **Current Phase**: `Phase 4: FORMALLY APPROVED AND CLOSED`
- **Phase 3**: FORMALLY APPROVED AND CLOSED (`2026-11-16`)
  - External re-review verdict: `ACCEPTED` ([PHASE_03_CLOSURE_VERIFICATION.md](./PHASE_03_CLOSURE_VERIFICATION.md))
- **Phase 4**: **FORMALLY APPROVED AND CLOSED** (`17 November 2026`)
  - Formal Project-Owner Approval Date: `17 November 2026`
  - Implementation Commit: `0e411f0`
  - External Re-Review Verdict: `APPROVED WITH MINOR OBSERVATIONS` ([PHASE_04_RE_REVIEW.md](./PHASE_04_RE_REVIEW.md))
  - Reviewed Commit: `39404cb`
  - Corrective Actions Report: [PHASE_04_CORRECTIVE_ACTIONS.md](./PHASE_04_CORRECTIVE_ACTIONS.md)
  - Scope Formally Closed: Strategy Lab (`/strategy-lab`), Risk Lab (`/risk-lab`), Robustness (`/robustness`)
- **Phase 5**: **LOCKED — REQUIRES EXPLICIT PROJECT-OWNER AUTHORIZATION**
  - **IMPORTANT NOTICE**: The project owner has **NOT** authorized Phase 5 implementation.
  - Implementation of Phase 5, Phase 6, public deployment, live trading, or merging into `main` is strictly prohibited until explicit authorization is issued.

---

## Project Backlog (Non-Blocking Observations R1–R4)

The following non-blocking items from Claude's Phase 4 re-review ([PHASE_04_RE_REVIEW.md](./PHASE_04_RE_REVIEW.md)) are recorded in the backlog for low-priority resolution during Phase 5 or later cleanup:

1. **R1 (Low — Unused Validation Helpers)**:
   - `calculateExitOvershoot` and `isHindsightNonInvestable` in `frontend/lib/validation/strategyForm.ts` are currently exercised only by tests, as the UI displays backend-supplied values directly.
   - Action: Either integrate them into component-level rendering or relocate them to test utilities during Phase 5 cleanup.
2. **R2 (Low — Honesty Banner Dynamic Copy)**:
   - The Robustness banner wording is currently tailored to historical test deterioration ("dropped to" / "severe deterioration").
   - Action: Generalize copy for hypothetical positive test periods and enhance fallback formatting for missing validation rows (`valPeriod?.cagr_pct`) during Phase 5 UI polish.
3. **R3 (Low — Static Date Literals)**:
   - Static string `"Partial Window (Starts 2020-04-10)"` remains in `DashboardClient.tsx:222` and static copy on `/markets`.
   - Action: Generalize to dynamic date binding via `resolveSolanaStartDate` during Phase 5 polish.
4. **R4 (Informational — Precision & Documentation)**:
   - Risk Lab validation error text ("between 1% and 100%") accepts `> 0 and <= 100` (e.g. `0.5%`). Align text and boundary during Phase 5 form review.
   - Document the 50ms mount debounce in `RobustnessClient` (React Strict Mode GIL contention avoidance).
   - Verify production-mode browser hydration in an isolated production browser run.

---

## Standing Phase 5 Plan (Awaiting Authorization)

When the project owner grants formal authorization for Phase 5 implementation:
1. **Reports Module (`/reports`, `ReportsClient.tsx`)**:
   - Connect to `GET /api/reports/summary` and `GET /api/reports/markdown`.
   - Comprehensive research summary rendering.
   - Markdown download button invoking `GET /api/reports/markdown` with proper filename.
2. **End-to-End QA & Polish**:
   - Address backlog items R1–R4.
   - Full regression across all 5 navigation routes (`/dashboard`, `/markets`, `/strategy-lab`, `/risk-lab`, `/robustness`, `/reports`).
   - Cross-browser and responsive layout verification.
   - Performance benchmarks and production bundle audit.
3. **Phase 5 Report & Documentation**:
   - Compile `docs/migration/PHASE_05_REPORT.md` and update tracking documentation.
