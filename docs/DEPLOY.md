# Deploy: Vercel (web) + Fly.io (API) + Postgres

## Recommended layout

| Piece | Where | Why |
|-------|--------|-----|
| **Web (React PWA)** | [Vercel](https://vercel.com) — root `web/`, build `npm run build`, output `dist` | Static + CDN; no server needed |
| **API (Go + WebSockets + uploads)** | [Fly.io](https://fly.io) — `backend/Dockerfile` | Long-lived WS, disk for `/uploads`, one container |
| **Database** | [Neon](https://neon.tech) or Fly Postgres | Managed Postgres; Neon pairs well with Fly (`sslmode=require`) |

Vercel does **not** run this Go API or Postgres. Do not put the backend on Vercel serverless without a major rewrite.

## 1. Database (Neon example)

1. Create a Neon project (region close to users, e.g. EU if CI-focused).
2. Copy the **pooled** connection string → `DATABASE_URL` for the API.
3. Run migrations on deploy (the API image entrypoint already migrates on start).

## 2. API on Fly.io

```bash
cd backend
fly deploy --app game-finder-api
```

From repo root (after **saving** `.env` to disk):

```powershell
.\scripts\fly-secrets.ps1 -App game-finder-api -VercelOrigin https://your-app.vercel.app
```

Set secrets (Fly dashboard or `fly secrets set`):

- `DATABASE_URL` — Neon URL with `?sslmode=require`
- `JWT_SECRET` — 32+ random bytes
- `CORS_ORIGINS` — `https://your-app.vercel.app` (comma-separated if multiple)
- `PUBLIC_BASE_URL` — `https://game-finder-api.fly.dev` (your Fly app URL)
- `ADMIN_EMAILS` — your email(s)
- `SEED_DEMO` — `false` in production
- `VITE_MAPBOX_ACCESS_TOKEN` — not needed on API unless you use server-side Mapbox
- `MAPBOX_ACCESS_TOKEN` — only if backend needs it
- Optional: `FCM_*` for push
- **R2 (recommended):** `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`

**Court photos & avatars:** use **Cloudflare R2** (see `.env.example`). Enable public access on the bucket or map a custom domain to `R2_PUBLIC_URL`. If R2 vars are unset, uploads use a Fly **volume** at `/data/uploads` instead.

**WebSockets:** Fly supports HTTP upgrade on the same app; clients use `wss://your-api.fly.dev/api/ws` (with ws-ticket flow).

## Production config cheat sheet

| Where | Variable | Value |
|-------|----------|--------|
| **Fly** (secrets) | `PUBLIC_BASE_URL` | `https://game-finder-api.fly.dev` |
| **Fly** | `DATABASE_URL`, `JWT_SECRET`, `R2_*`, `SEED_DEMO=false` | from root `.env` via `.\scripts\fly-secrets.ps1` |
| **Fly** | `CORS_ORIGINS` | localhost dev origins **+** `https://<your-project>.vercel.app` |
| **Vercel** | `VITE_API_URL` | `https://game-finder-api.fly.dev` |
| **Vercel** | `VITE_MAPBOX_ACCESS_TOKEN` | same as root `.env` |
| **Vercel** | `VITE_MEDIA_PUBLIC_ORIGIN` | public R2 URL (`*.r2.dev`), if not using default allowlist |
| **Root `.env`** | `VITE_API_URL`, `API_URL`, `PUBLIC_BASE_URL` | same Fly URL for web build + mobile sync |
| **Mobile** | run `mobile\sync-env.ps1` | writes `mobile/assets/.env` from root `.env` |

After changing `CORS_ORIGINS` or API secrets locally, run `.\scripts\fly-secrets.ps1` again (one at a time; wait for it to finish).

## 3. Web on Vercel

- **Root directory:** `web`
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Environment variables (build time):**
  - `VITE_MAPBOX_ACCESS_TOKEN` — your Mapbox public token
  - `VITE_API_URL` — `https://game-finder-api.fly.dev` (no trailing slash)
  - `VITE_MEDIA_PUBLIC_ORIGIN` — same as `R2_PUBLIC_URL` when using a custom CDN domain (optional for `*.r2.dev`)

The web app calls the API on that host (not same-origin proxy). Set API `CORS_ORIGINS` to your Vercel URL.

**PWA / uploads:** Avatar and court photos load from `PUBLIC_BASE_URL` on the API (`/uploads/...`).

## 4. Mobile app

Point `mobile/assets/.env` (via `sync-env.ps1` from root `.env`):

- `API_URL=https://game-finder-api.fly.dev`
- `MAPBOX_ACCESS_TOKEN=...`

## 5. Mapbox

Restrict your public token by URL (Vercel domain) in the Mapbox dashboard.

## Local vs production

| | Local (docker compose) | Production |
|--|------------------------|------------|
| Web | `:9099` (nginx → api) | Vercel |
| API | `:8080` | Fly |
| DB | Docker Postgres | Neon / Fly Postgres |

## Checklist before first prod traffic

- [ ] `SEED_DEMO=false`
- [ ] Strong `JWT_SECRET`
- [ ] `ADMIN_EMAILS` set to real admins
- [ ] CORS only your real web origins
- [ ] Do **not** apply `0009_clear_courts.sql` on prod data
- [ ] Fly volume for uploads (or plan S3 later)
