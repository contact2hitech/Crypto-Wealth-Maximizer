# Crypto Wealth Maximizer v2.0 — Frontend

Next.js App Router + React + TypeScript + Tailwind CSS + `shadcn/ui` frontend for the Crypto Wealth Maximizer v2.0 migration.

## Local Development

1. Start the FastAPI backend from the repository root (`http://127.0.0.1:8000`):

```powershell
.\venv\Scripts\python.exe -m uvicorn backend.main:app --reload --port 8000
```

2. Optionally copy `.env.example` to `.env.local`:

```powershell
Copy-Item frontend\.env.example frontend\.env.local
```

3. Start the Next.js development server (`http://localhost:3000`):

```powershell
cd frontend
npm install
npm run dev
```

## Verification Scripts

```powershell
npx tsc --noEmit
npm run lint
npm run build
```

## Architecture Notes

- All financial calculations come exclusively from the Python FastAPI backend (`NEXT_PUBLIC_API_BASE_URL`).
- Heavy calculation requests configure timeouts of `60s`–`90s` (`frontend/lib/api/client.ts`) to accommodate cold analytical runs.
- Six primary routes: `/dashboard` (`/` redirects here), `/markets`, `/strategy-lab`, `/risk-lab`, `/robustness`, and `/reports`.
