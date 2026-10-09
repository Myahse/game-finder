# Out For Ground

> Don't search for a court. **Find the game.**

Open the app → see nearby live games → select one → join → navigate to the court.
Basketball first; the data model supports any sport.

| Part | Stack | Folder |
|------|-------|--------|
| API | Go 1.26, chi, pgx, PostgreSQL 16, WebSockets | [`backend/`](backend) |
| Web app + admin dashboard | React 19, TypeScript, Vite, Tailwind, Mapbox GL | [`web/`](web) |
| Mobile app (Android/iOS) | Flutter, flutter_map, FCM, local notifications | [`mobile/`](mobile) |

## Quick start

```bash
cp .env.example .env            # set JWT_SECRET, ADMIN_EMAILS, VITE_MAPBOX_ACCESS_TOKEN
docker compose up --build       # Postgres + API (:8080) + web (see compose for host port)
```

Open http://localhost:5173 and create an account. If you register with an email from `ADMIN_EMAILS`, you get the **Admin** dashboard. `SEED_DEMO=true` loads 8 demo courts around Grand-Bassam and Abidjan. Their coordinates are approximate, so verify them before launch.

### Run pieces individually

```bash
# API (needs a Postgres database; migrations run automatically)
cd backend
DATABASE_URL=postgres://... JWT_SECRET=$(openssl rand -base64 48) SEED_DEMO=true go run ./cmd/api

# Web
cd web && npm install && VITE_API_URL=http://localhost:8080 npm run dev

# Mobile (Android emulator reaches the host at 10.0.2.2)
cd mobile && flutter run --dart-define=API_URL=http://10.0.2.2:8080
```

## How it works

### Court status

`court_live_stats` is a small table that triggers keep up to date whenever check-ins or game players change:

| Status | Rule | Marker |
|--------|------|--------|
| **GAME ACTIVE** | an active game with ≥1 player, **or** ≥ `active_court_min_players` (default 6) people checked in | green marker with sport icon + count |
| **PLAYERS PRESENT** | 1+ people checked in, no game | yellow marker with groups icon + count |
| **INACTIVE** | nobody | gray marker with sport icon only |

`player_count` counts distinct people who are checked in **or** joined to an active game at the court.

### Realtime

Postgres `NOTIFY` (from triggers) → Go `LISTEN` → WebSocket `/api/ws` → clients. Events:

- `court_stats`: new count/status for a court. Markers recolour instantly.
- `game`: a game was created, updated, cancelled, or players changed (`7/10 → 8/10`).
- `notification`: sent only to the recipient's own connections.

Clients reconnect with back-off and refetch on reconnect.

### Presence ("I'M HERE")

- A check-in requires being within `presence_max_distance_m` (500 m) of the court.
- Each check-in has `started_at`, `last_seen` and `expires_at` (default 30 min, set by `presence_minutes`).
- `presence_warning_minutes` (5) before expiry, the user is asked **"Are you still playing?"**, with **YES, I'M STILL HERE** or **I LEFT**:
  - **Mobile:** an on-device scheduled notification with action buttons. It works offline.
  - **Web:** an in-app prompt.
- If nobody answers, the server's minute job expires the check-in.
- Every duration and threshold is in the `app_settings` table, editable from **Admin → Settings** without a deploy.

### Joining games safely

`join_game()` locks the game row. Duplicate joins, full games, and cancelled or finished games are rejected in SQL. A test sends 12 simultaneous joins at a 4-spot game; exactly 3 succeed.

### Location privacy

- Exact check-in coordinates are stored only on the user's own presence row. The API never returns them to anyone else.
- Other users only see court-level aggregates ("8 players").
- For "game active near you" alerts, the app stores a **coarse** area rounded to about 1 km.

### Notifications

The minute job (`tick()`) generates:

- game reminders (30 min before start)
- "🔥 A basketball game is active 1.2 km from you" alerts (radius and cooldown in settings)
- presence checks

Invites and cancellations are created immediately. All of these appear in-app and over the WebSocket. If FCM is configured, the Go dispatcher also pushes them to devices via **Firebase Cloud Messaging HTTP v1**.

To enable push:

1. Create a Firebase project.
2. Add `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) to the Flutter app.
3. Set `FCM_PROJECT_ID` and `FCM_SERVICE_ACCOUNT_JSON` for the API.

Without them, everything still works in-app.

### Adding a sport

Insert a row in `sports` (or set `active = true` on an existing row). Filters, markers, court tags and game creation all read from the API, so no client release is needed.

### Security

- Passwords are hashed with bcrypt.
- Short-lived HS256 access tokens plus rotating, single-use refresh tokens (stored hashed).
- Auth endpoints are rate-limited per IP.
- Every authenticated request re-checks that the account exists and isn't suspended. Suspending a user also revokes their sessions and ends their check-in.
- Each request runs in a transaction with `app.user_id` set. SQL functions enforce ownership:
  - only creators edit or cancel their games
  - presence is written only through `mark_present` / `confirm_presence` / `end_presence`, for yourself
  - user court proposals are forced to `pending`
  - admin functions call `assert_admin()`
- Uploads are sniffed for JPEG/PNG/WebP and size-limited.

## API overview

```
POST /api/auth/register | login | refresh | logout     GET /api/auth/username-available
GET  /api/sports    GET /api/courts/nearby?lat&lng[&sport]   (public)
GET  /api/me  PATCH /api/me  POST /api/me/notify-area  POST|DELETE /api/me/push-tokens
GET  /api/me/games  GET /api/me/presence  GET /api/users/:id
GET  /api/courts/:id  POST /api/courts (propose)  POST /api/courts/:id/reports
GET  /api/games/nearby  POST /api/games  GET|PATCH /api/games/:id
POST /api/games/:id/join | leave | cancel | invite
POST /api/presence  POST /api/presence/confirm  DELETE /api/presence
GET  /api/notifications  POST /api/notifications/:id/read  POST /api/notifications/read-all
POST /api/uploads (multipart: kind=avatar|court, file)
GET  /api/ws  (WebSocket; ?token= for signed-in events)
/api/admin/* : stats, courts (create/edit/review/delete), games (cancel/delete),
               users (suspend/delete), reports (resolve), settings
```

## Tests

```bash
cd backend && TEST_DATABASE_URL=postgres://.../ftg_test go test -p 1 ./...   # end-to-end API tests on real Postgres
cd web && npm test && npm run build
cd mobile && flutter analyze && flutter test
```

CI runs all three (`.github/workflows/ci.yml`).

## Map tiles

- **Web:** [Mapbox GL](https://www.mapbox.com/) via `react-map-gl` — set `VITE_MAPBOX_ACCESS_TOKEN` in `.env` (baked in at `docker compose build`). Optional style overrides: `VITE_MAP_STYLE_LIGHT` / `VITE_MAP_STYLE_DARK` (Mapbox style URLs).
- **Mobile:** flutter_map with Mapbox raster tiles — pass `--dart-define=MAPBOX_ACCESS_TOKEN=pk....` (same token as web).

Create a token at [mapbox.com](https://account.mapbox.com/access-tokens/) and restrict it by URL in production.

## Roadmap

- **V2:** player search, invitations UI, chat, favorites, ratings and reputation, more sports, recurring games
- **V3:** reservations, payments, tournaments, teams, clubs, academies, coaches
- **V4:** Grand-Bassam → Abidjan → Côte d'Ivoire → West Africa → international

The metric that matters: **how many people find and join a game through the app.**
