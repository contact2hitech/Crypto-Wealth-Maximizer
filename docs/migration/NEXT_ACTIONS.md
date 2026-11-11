# Next Actions — Phase 1 Review Gate & Phase 2 Preparation

## Authoritative Gate Status
- **Status**: `AWAITING_EXTERNAL_REVIEW`
- **Current Phase Completed**: Phase 1 (Python Backend and FastAPI Foundation)
- **Next Phase**: Phase 2 (Next.js Frontend Foundation)
- **Instruction**: Do **not** begin Phase 2 frontend implementation until Phase 1 has been reviewed and Phase 2 is authorized in this file (or explicit user approval is received).

---

## Proposed Phase 2 Scope (Subject to Reviewer Confirmation)

When approved to proceed to Phase 2, execute the following tasks on branch `v2.0-nextjs-migration`:

1. **Initialize Next.js Frontend (`frontend/`)**:
   - Next.js (App Router) + React + TypeScript + Tailwind CSS.
   - Install and configure `shadcn/ui` primitives and Lucide icons.
   - Establish dark-theme financial research design tokens (deep charcoal/navy surfaces, crisp subtle borders, tabular high-contrast numerical typography, restrained visual polish).

2. **Application Shell & Navigation**:
   - Reusable layout shell (`components/layout/`) with top navigation bar linking all 6 required pages:
     - `/dashboard` (and `/` redirecting or rendering Dashboard cleanly)
     - `/markets`
     - `/strategy-lab`
     - `/risk-lab`
     - `/robustness`
     - `/reports`
   - Application branding, active route indicator, responsive mobile drawer/menu, live backend API connection status badge (polling/querying `GET /api/health`), and dataset last-update/coverage indicator.

3. **Reusable UI Primitives & Typed API Client**:
   - Reusable metric cards, data-quality badges, research warning banners, loading skeletons, structured error states, and empty states (`components/common/`, `components/dashboard/`).
   - Environment-configured API base URL (`NEXT_PUBLIC_API_BASE_URL`, defaulting to `http://127.0.0.1:8000` in `.env.example`, never hardcoded production URLs or secrets).
   - Typed TypeScript interfaces (`frontend/types/`) matching Phase 1 Pydantic response schemas and typed API client (`frontend/lib/api/`) with generous timeouts (`>= 60s` for heavy cold simulation endpoints per `KI-004`).

4. **Phase 2 Verification Gate**:
   - Frontend starts cleanly (`npm run dev`).
   - All 6 routes load cleanly on desktop and mobile viewports without runtime or console errors.
   - Top navigation and live `/api/health` connection status indicator verified against the running FastAPI backend.
   - Zero hardcoded fake financial figures (`$`, `%`, Sharpe, etc.) anywhere in frontend components.
   - `npm run lint`, TypeScript typecheck (`tsc --noEmit`), and `npm run build` succeed.
