# Test Results — Crypto Wealth Maximizer v2.0 Migration

All results below were directly executed and observed in the local environment (`Windows`, `Python 3.13.9` via `.\venv\Scripts\python.exe`, `Node v24.14.1`, `npm 11.11.0`, `Next.js 16.4.6`).

---

## Phase 2 Verification (Next.js Frontend Foundation, `2026-11-12`)

### 1. TypeScript Check (`npx tsc --noEmit`)
Command (inside `frontend/`):
```powershell
npx tsc --noEmit
```
Result: **PASS (exit code 0, zero TypeScript errors)**

### 2. ESLint Check (`npm run lint`)
Command (inside `frontend/`):
```powershell
npm run lint
```
Result: **PASS (exit code 0, zero ESLint errors/warnings)**

### 3. Production Build (`npm run build`)
Command (inside `frontend/`):
```powershell
npm run build
```
Result: **PASS (Next.js 16.4.6 Turbopack, compiled in `17.1s`, TypeScript in `9.1s`, 10/10 static pages generated in `1204ms`)**
Routes generated: `/`, `/_not-found`, `/dashboard`, `/markets`, `/reports`, `/risk-lab`, `/robustness`, `/strategy-lab`.

### 4. Live Dev Server & Backend `/api/health` CORS Verification (`next dev` + `uvicorn`)
Servers started: `uvicorn backend.main:app --host 127.0.0.1 --port 8000` and `npm --prefix frontend run dev -- --port 3000`.
Verified via `httpx`:
- `GET http://localhost:3000/` -> `307` (`Location: /dashboard`)
- `GET http://localhost:3000/dashboard` -> `200` (`38,207` bytes, `dark=True`, `nav_links=True`)
- `GET http://localhost:3000/markets` -> `200` (`38,316` bytes, `dark=True`, `nav_links=True`)
- `GET http://localhost:3000/strategy-lab` -> `200` (`38,271` bytes, `dark=True`, `nav_links=True`)
- `GET http://localhost:3000/risk-lab` -> `200` (`37,887` bytes, `dark=True`, `nav_links=True`)
- `GET http://localhost:3000/robustness` -> `200` (`38,318` bytes, `dark=True`, `nav_links=True`)
- `GET http://localhost:3000/reports` -> `200` (`38,058` bytes, `dark=True`, `nav_links=True`)
- `GET http://127.0.0.1:8000/api/health` (`Origin: http://localhost:3000`) -> `200`, `Access-Control-Allow-Origin: http://localhost:3000`, `status: "ok"`.

*Note on headless browser automation*: Chrome DevTools MCP (`browser` subagent) could not attach because Chrome remote debugging (`DevToolsActivePort`) was not active on the Windows host; visual screenshot capture is noted as pending interactive browser attachment in `KNOWN_ISSUES.md`.

### 5. Backend API & Parity Suite Re-run (`backend/tests`)
Command:
```powershell
.\venv\Scripts\python.exe -m unittest discover -s backend/tests -v
```
Result: **PASS (`21 / 21` tests in `119.075s`, `OK`)**

### 6. Existing v1.0 Unit Suite Re-run (`tests`)
Command:
```powershell
.\venv\Scripts\python.exe -m unittest discover -s tests -v
```
Result: **PASS (`26 / 26` tests in `77.775s`, `OK`)**

---

## Phase 1 Verification (FastAPI Backend & v1.0 Parity, `2026-11-11`)
- `backend/tests`: `21 / 21` passed (`81.071s`, `OK`)
- `tests`: `26 / 26` passed (`53.418s`, `OK`)
- Live Uvicorn HTTP benchmark: all 10 REST endpoints returned `200 / 200` cold & warm.

## Phase 0 Baseline Verification (`2026-11-11`)
- `tests`: `26 / 26` passed (`71.734s`, `OK`)
- `validate_data.py`: exit 0 (`3,653` rows, `2016-11-09`..`2026-11-09`)
- `validate_optimizer.py`: exit 0 (`0..10` max switches `PASS`)
