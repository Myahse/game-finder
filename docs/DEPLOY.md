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
fly launch --no-deploy   # name e.g. game-finder-api, region cdg or iad
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

**Uploads:** attach a Fly volume and mount at `/data/uploads` (match `UPLOAD_DIR` in config / Dockerfile).

**WebSockets:** Fly supports HTTP upgrade on the same app; clients use `wss://your-api.fly.dev/api/ws` (with ws-ticket flow).

## 3. Web on Vercel

- **Root directory:** `web`
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Environment variables (build time):**
  - `VITE_MAPBOX_ACCESS_TOKEN` — your Mapbox public token
  - `VITE_API_URL` — `https://game-finder-api.fly.dev` (no trailing slash)

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
