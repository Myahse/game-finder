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
| `PUBLIC_BASE_URL` | `https://game-finder-ddcm.onrender.com` |
| `CORS_ORIGINS` | `http://localhost:5173,https://game-finder-swart.vercel.app` |
| `ADMIN_EMAILS` | `you@example.com` |
| `SEED_DEMO` | `false` |
| `R2_*` | Cloudflare R2 credentials + public `*.r2.dev` URL |

5. **Deploy** (auto on git push if connected).
6. Health check: `https://game-finder-ddcm.onrender.com/healthz` → `{"ok":true}`.

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

**WebSockets:** Supported on Render web services (`wss://game-finder-ddcm.onrender.com/api/ws`).

---

## 3. Web on Vercel

- **Root directory:** `web`
- **Build:** `npm run build` → output `dist`
- **Environment (build time):**
  - `VITE_API_URL` = `https://game-finder-ddcm.onrender.com` (no trailing slash)
  - `VITE_MAPBOX_ACCESS_TOKEN`
  - `VITE_MEDIA_PUBLIC_ORIGIN` = your public R2 URL (optional if using default allowlist)
  - `VITE_GOOGLE_CLIENT_ID` = Google **Web** client ID (optional; shows "Continue with Google")

Redeploy Vercel after changing `VITE_API_URL`.

---

## 4. Root `.env` + mobile

```env
PUBLIC_BASE_URL=https://game-finder-ddcm.onrender.com
VITE_API_URL=https://game-finder-ddcm.onrender.com
API_URL=https://game-finder-ddcm.onrender.com
```

```powershell
.\mobile\sync-env.ps1
```

---

## Google Sign-In

"Continue with Google" appears on web and mobile once these are set. Without them it is hidden and email/password still works.

**1. Create OAuth clients** in [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (one project). Configure the **OAuth consent screen** first: app name, support email, scopes `openid email profile`. Then create:

| Client type | Settings | Used by |
|---|---|---|
| **Web application** | Authorized JavaScript origins: `https://game-finder-swart.vercel.app`, your custom domain, `http://localhost:5173`, `http://localhost:9099`. No redirect URIs needed. | Web, and Android/iOS as the token audience |
| **Android** | Package `com.findthegame.find_the_game` + SHA-1 of each signing key (`keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android`, plus your release/Play key) | Android app |
| **iOS** | Bundle ID from Xcode (`Runner` target) | iOS app |

**2. Set the IDs**

```env
# Render (API) — accepted token audiences
GOOGLE_CLIENT_IDS=<web-client-id>,<ios-client-id>
# Vercel (web) and root .env (synced to mobile by sync-env.ps1)
VITE_GOOGLE_CLIENT_ID=<web-client-id>
GOOGLE_IOS_CLIENT_ID=<ios-client-id>
```

The Android client ID is not set anywhere: Google matches it by package name and SHA-1, and the app asks for tokens issued to the **web** client ID.

**3. iOS only:** add the *reversed* iOS client ID (`com.googleusercontent.apps.…`) as a URL scheme in `mobile/ios/Runner/Info.plist` under `CFBundleURLTypes`.

**How accounts are matched:** the API verifies the ID token's signature against Google's keys, and checks the issuer, the audience (must be in `GOOGLE_CLIENT_IDS`) and expiry. It also requires a verified email.
- An account already linked to that Google account signs in.
- An existing account with the same email gets linked; its password keeps working.
- Otherwise a new account is created: the username comes from the email, the name from Google, and onboarding comes next.
- An email already linked to a *different* Google account is refused.

If you use the Docker web image, `web/nginx.conf`'s Content-Security-Policy already allows `accounts.google.com/gsi`.

---

## Production cheat sheet

| Where | Variable | Value |
|-------|----------|--------|
| **Render** | `PUBLIC_BASE_URL` | `https://game-finder-ddcm.onrender.com` |
| **Render** | `DATABASE_URL`, `JWT_SECRET`, `R2_*`, `CORS_ORIGINS` | from `.env` via `render-env.ps1` |
| **Vercel** | `VITE_API_URL` | same Render URL |
| **Vercel** | `VITE_MAPBOX_ACCESS_TOKEN` | Mapbox public token |
| **Render** | `GOOGLE_CLIENT_IDS` | Web (+ iOS) Google client IDs, comma-separated |
| **Vercel** | `VITE_GOOGLE_CLIENT_ID` | Google Web client ID |

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
