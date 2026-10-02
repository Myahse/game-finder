# Deploy: Vercel (web) + Render (API, free tier) + Neon (DB)

## Recommended layout

| Piece | Where | Why |
|-------|--------|-----|
| **Web (React PWA)** | [Vercel](https://vercel.com) — root `web/`, build `npm run build`, output `dist` | Static + CDN |
| **API (Go + WebSockets)** | [Render](https://render.com) — `backend/Dockerfile`, **free** web service | Docker, no card required for free tier |
| **Database** | [Neon](https://neon.tech) | Managed Postgres (`sslmode=require`) |
| **Media** | [Cloudflare R2](https://developers.cloudflare.com/r2/) | **Required on Render free** (disk is ephemeral) |

Vercel does **not** run this Go API. Do not put the backend on Vercel serverless without a major rewrite.

### Free-tier tradeoffs (Render)

- Service **sleeps after ~15 minutes** with no traffic; first request after sleep can take **30–60s** (cold start).
- **No persistent disk** on free — configure **R2** for court photos and avatars.
- **750 instance-hours/month** on free (enough for one small API if it sleeps when idle).

---

## 1. Database (Neon)

1. Create a Neon project (region close to users).
2. Copy the **pooled** connection string → `DATABASE_URL` (include `?sslmode=require`).
3. Migrations run on API container start (`docker-entrypoint.sh` → `/api`).

---

## 2. API on Render (free)

### Option A — Blueprint (repo already has `render.yaml`)

1. [Render](https://dashboard.render.com) → **New** → **Blueprint**.
2. Connect GitHub repo `Myahse/game-finder`.
3. Render creates web service `game-finder-api` from `render.yaml`.
4. In the dashboard, set **secret** env vars (Render will prompt for `sync: false` keys).

From repo root (after `.env` is filled):

```powershell
.\scripts\render-env.ps1 -VercelOrigin https://game-finder-swart.vercel.app
```

Copy the printed values into **Render → game-finder-api → Environment**.

Set at minimum:

| Variable | Example |
|----------|---------|
| `DATABASE_URL` | Neon pooled URL |
| `JWT_SECRET` | 32+ random chars |
| `PUBLIC_BASE_URL` | `https://game-finder-api.onrender.com` |
| `CORS_ORIGINS` | `http://localhost:5173,https://game-finder-swart.vercel.app` |
| `ADMIN_EMAILS` | `you@example.com` |
| `SEED_DEMO` | `false` |
| `R2_*` | Cloudflare R2 credentials + public `*.r2.dev` URL |

5. **Deploy** (auto on git push if connected).
6. Health check: `https://game-finder-api.onrender.com/healthz` → `ok`.

### Option B — Manual web service

1. **New → Web Service** → connect repo.
2. **Root directory:** `backend`
3. **Runtime:** Docker  
   - Dockerfile path: `Dockerfile`  
   - Docker context: `.`  
   (Equivalent: repo root + root `Dockerfile` that builds `backend/` — see repo root `Dockerfile`.)
4. **Plan:** Free  
5. **Health check path:** `/healthz`  
6. Add the same env vars as above.

**WebSockets:** Supported on Render web services (`wss://game-finder-api.onrender.com/api/ws`).

---

## 3. Web on Vercel

- **Root directory:** `web`
- **Build:** `npm run build` → output `dist`
- **Environment (build time):**
  - `VITE_API_URL` = `https://game-finder-api.onrender.com` (no trailing slash)
  - `VITE_MAPBOX_ACCESS_TOKEN`
  - `VITE_MEDIA_PUBLIC_ORIGIN` = your public R2 URL (optional if using default allowlist)

Redeploy Vercel after changing `VITE_API_URL`.

---

## 4. Root `.env` + mobile

```env
PUBLIC_BASE_URL=https://game-finder-api.onrender.com
VITE_API_URL=https://game-finder-api.onrender.com
API_URL=https://game-finder-api.onrender.com
```

```powershell
.\mobile\sync-env.ps1
```

---

## Production cheat sheet

| Where | Variable | Value |
|-------|----------|--------|
| **Render** | `PUBLIC_BASE_URL` | `https://game-finder-api.onrender.com` |
| **Render** | `DATABASE_URL`, `JWT_SECRET`, `R2_*`, `CORS_ORIGINS` | from `.env` via `render-env.ps1` |
| **Vercel** | `VITE_API_URL` | same Render URL |
| **Vercel** | `VITE_MAPBOX_ACCESS_TOKEN` | Mapbox public token |

---

## Legacy: Fly.io

Fly requires a card after trial. Config remains in `backend/fly.toml` and `scripts/fly-secrets.ps1` if you return to Fly later.

---

## Checklist before prod traffic

- [ ] `SEED_DEMO=false`
- [ ] Strong `JWT_SECRET`
- [ ] `ADMIN_EMAILS` set
- [ ] **R2 configured** (Render free)
- [ ] CORS includes every Vercel URL you use
- [ ] `VITE_API_URL` matches `PUBLIC_BASE_URL`
- [ ] Do **not** apply `0009_clear_courts.sql` on prod data

---

## Local vs production

| | Local | Production |
|--|--------|------------|
| Web | `:9099` or Vite `:5173` | Vercel |
| API | `:8080` | Render |
| DB | Docker Postgres or Neon | Neon |
