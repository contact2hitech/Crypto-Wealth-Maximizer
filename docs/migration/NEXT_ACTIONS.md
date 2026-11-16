# Next Actions — Phase 4 Completion & External Review Submission

## Authoritative Gate Status
- **Current Phase**: `PHASE_04_COMPLETED_AWAITING_REVIEW`
- **Phase 3**: FORMALLY APPROVED AND CLOSED (`2026-11-16`)
  - External re-review verdict: `ACCEPTED` ([PHASE_03_CLOSURE_VERIFICATION.md](./PHASE_03_CLOSURE_VERIFICATION.md))
- **Phase 4**: COMPLETED — AWAITING EXTERNAL TECHNICAL REVIEW (`2026-11-16`)
  - Implementation Commit: `0e411f0` (`feat(phase4): implement Strategy Lab, Risk Lab, and Robustness modules`)
  - Report: [PHASE_04_REPORT.md](./PHASE_04_REPORT.md)
  - Review Package: [PHASE_04_EXTERNAL_REVIEW.md](./PHASE_04_EXTERNAL_REVIEW.md)
  - Scope Completed: Strategy Lab (`/strategy-lab`), Risk Lab (`/risk-lab`), Robustness (`/robustness`)
- **Phase 5**: LOCKED — REQUIRES EXTERNAL REVIEW SIGN-OFF AND PROJECT-OWNER AUTHORIZATION

---

## Immediate Next Steps (Phase 4 External Review)

1. **Submit for External Technical Review**:
   - The Phase 4 implementation (commit `0e411f0`) and verification results are submitted for independent external technical review.
   - Review scope: Strategy Lab, Risk Lab, and Robustness integration, endpoint data reconciliation, time-scale Recharts rendering, research honesty disclaimers, test coverage, and backend immutability.

2. **Await Review Verdict & Authorization**:
   - Maintain branch `v2.0-nextjs-migration` in clean state.
   - Do NOT begin Phase 5 (Reports, QA and release preparation) until external review is completed and project owner provides formal authorization.

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
