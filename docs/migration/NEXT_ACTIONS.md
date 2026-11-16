# Next Actions — Phase 4 Corrective Actions & External Re-Review Handover

## Authoritative Gate Status
- **Current Phase**: `Phase 4: CORRECTIONS IMPLEMENTED — AWAITING EXTERNAL RE-REVIEW`
- **Phase 3**: FORMALLY APPROVED AND CLOSED (`2026-11-16`)
  - External re-review verdict: `ACCEPTED` ([PHASE_03_CLOSURE_VERIFICATION.md](./PHASE_03_CLOSURE_VERIFICATION.md))
- **Phase 4**: CORRECTIONS IMPLEMENTED — AWAITING EXTERNAL RE-REVIEW (`2026-11-17`)
  - Implementation Commit: `0e411f0`
  - Review Report: [PHASE_04_EXTERNAL_TECHNICAL_REVIEW.md](./PHASE_04_EXTERNAL_TECHNICAL_REVIEW.md) (Claude, verdict `REJECTED`)
  - Corrective Actions Report: [PHASE_04_CORRECTIVE_ACTIONS.md](./PHASE_04_CORRECTIVE_ACTIONS.md)
  - Review Package: [PHASE_04_EXTERNAL_REVIEW.md](./PHASE_04_EXTERNAL_REVIEW.md)
  - Phase Report: [PHASE_04_REPORT.md](./PHASE_04_REPORT.md)
  - Scope Completed & Corrected: Strategy Lab (`/strategy-lab`), Risk Lab (`/risk-lab`), Robustness (`/robustness`)
- **Phase 5**: LOCKED — REQUIRES EXTERNAL REVIEW SIGN-OFF AND PROJECT-OWNER AUTHORIZATION

---

## Immediate Next Steps (Phase 4 External Re-Review)

1. **Submit for External Technical Re-Review**:
   - The Phase 4 corrective implementation and full verification results are submitted for independent external technical re-review by Claude.
   - Recommended Review Focus:
     - D1: Dynamic derivation of honesty banner in `RobustnessClient.tsx` without hardcoded statistics or unsupported narratives.
     - D2: Live reporting figures reconciled across all 6 endpoints in `PHASE_04_CORRECTIVE_ACTIONS.md` and `PHASE_04_REPORT.md`.
     - D3: Live assertions across all Strategy Lab, Risk Lab, and Robustness tabs in `verify_phase4.mjs`.
     - D4: Shared production validation in `frontend/lib/validation/strategyForm.ts` and non-circular unit tests in `phase4Labs.test.mts`.
     - D5: Elimination of literal fallbacks in `DashboardClient.tsx` and `benchmarkComparisons.ts`.
     - D6: Perfect Hindsight fee-free disclaimer and fee control annotation in `StrategyLabClient.tsx`.
     - D7: Documentation of Playwright caret-color injection causing development hydration warnings in `KNOWN_ISSUES.md`.

2. **Await Re-Review Verdict & Project-Owner Authorization**:
   - Maintain branch `v2.0-nextjs-migration` in clean state.
   - Do NOT begin Phase 5 (Reports, QA and release preparation) until external re-review approves Phase 4 and project owner provides formal authorization.

---

## Pending Phase 5 Implementation Plan (Post-Authorization)

Once Phase 4 is approved and Phase 5 is authorized by the project owner:
1. **Reports Module (`/reports`, `ReportsClient.tsx`)**:
   - Connect to `GET /api/reports/summary` and `GET /api/reports/markdown`.
   - Comprehensive research summary rendering.
   - Markdown download button invoking `GET /api/reports/markdown` with proper filename.
2. **End-to-End QA & Polish**:
   - Full regression across all 5 navigation routes (`/dashboard`, `/markets`, `/strategy-lab`, `/risk-lab`, `/robustness`, `/reports`).
   - Cross-browser and responsive layout verification.
   - Performance benchmarks and production bundle audit.
3. **Phase 5 Report & Documentation**:
   - Compile `docs/migration/PHASE_05_REPORT.md` and update tracking documentation.
