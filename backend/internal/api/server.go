// Package api is the HTTP + WebSocket interface used by the web and mobile apps.
package api

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/coder/websocket"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"findthegame/backend/internal/auth"
	"findthegame/backend/internal/config"
	"findthegame/backend/internal/db"
	"findthegame/backend/internal/mail"
	"findthegame/backend/internal/push"
	"findthegame/backend/internal/realtime"
	"findthegame/backend/internal/storage"
)

type Server struct {
	cfg             config.Config
	db              *db.DB
	tokens          *auth.Issuer
	hub             *realtime.Hub
	limit           *rateLimiter
	browseLimit     *rateLimiter
	userCourtLimit  *rateLimiter
	userGameLimit   *rateLimiter
	userNotifyLimit *rateLimiter
	trustedProxies  []*net.IPNet
	media           *storage.Media
	google          *auth.GoogleVerifier
	firebase        *auth.FirebaseVerifier
	mailer          *mail.Resend
	weather         *weatherCache
	push            push.Sender // nil when FCM isn't configured
}

func New(cfg config.Config, d *db.DB, hub *realtime.Hub, media *storage.Media) *Server {
	return &Server{
		cfg:             cfg,
		db:              d,
		tokens:          auth.NewIssuer(cfg.JWTSecret, cfg.AccessTokenTTL),
		hub:             hub,
		limit:           newRateLimiter(30, time.Minute),
		browseLimit:     newRateLimiter(90, time.Minute),
		userCourtLimit:  newRateLimiter(10, time.Hour),
		userGameLimit:   newRateLimiter(40, time.Hour),
		userNotifyLimit: newRateLimiter(6, time.Hour),
		trustedProxies:  parseTrustedCIDRs(cfg.TrustedProxyCIDRs),
		media:           media,
		google:          newGoogleVerifier(cfg),
		firebase:        newFirebaseVerifier(cfg),
		mailer:          mail.NewResend(cfg.ResendAPIKey, cfg.EmailFrom),
		weather:         newWeatherCache(cfg.WeatherURL),
	}
}

// WithPush enables direct sends (the push test); nil keeps push off.
func (s *Server) WithPush(sender push.Sender) *Server {
	s.push = sender
	return s
}

func newGoogleVerifier(cfg config.Config) *auth.GoogleVerifier {
	v := auth.NewGoogleVerifier(cfg.GoogleClientIDs)
	if cfg.GoogleJWKSURL != "" {
		v.WithJWKSURL(cfg.GoogleJWKSURL)
	}
	return v
}

func newFirebaseVerifier(cfg config.Config) *auth.FirebaseVerifier {
	v := auth.NewFirebaseVerifier(cfg.FirebaseProjectID)
	if cfg.FirebaseJWKSURL != "" {
		v.WithJWKSURL(cfg.FirebaseJWKSURL)
	} else if cfg.GoogleJWKSURL != "" {
		v.WithJWKSURL(cfg.GoogleJWKSURL)
	}
	return v
}

func parseTrustedCIDRs(raw string) []*net.IPNet {
	var out []*net.IPNet
	for _, part := range strings.Split(raw, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		if !strings.Contains(part, "/") {
			part += "/32"
		}
		_, n, err := net.ParseCIDR(part)
		if err == nil {
			out = append(out, n)
		}
	}
	return out
}

func (s *Server) Routes() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID, middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowOriginFunc:  func(_ *http.Request, origin string) bool { return s.corsAllowed(s.cfg.CORSOrigins, origin) },
		AllowedMethods:   []string{"GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type", "Accept-Language"},
		AllowCredentials: true,
		MaxAge:           600,
	}))
	r.Use(s.authenticate)
	r.Use(withRequestLocale)

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		if err := s.db.Pool.Ping(r.Context()); err != nil {
			http.Error(w, "db down", http.StatusServiceUnavailable)
			return
		}
		var devices int
		_ = s.db.Pool.QueryRow(r.Context(), `select count(*) from push_tokens`).Scan(&devices)
		// push: whether the server can send phone notifications (FCM configured).
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "ws_clients": s.hub.Count(), "push": s.push != nil, "push_devices": devices})
	})
	r.Handle("/uploads/*", http.StripPrefix("/uploads/", noDirListing(http.FileServer(http.Dir(s.cfg.UploadDir)))))

	// WebSockets are long-lived: keep them outside the request timeout.
	r.Get("/api/ws", s.handleWS)

	r.Route("/api", func(r chi.Router) {
		r.Use(middleware.Timeout(30 * time.Second))

		r.Route("/auth", func(r chi.Router) {
			r.With(s.rateLimited).Post("/register", s.register)
			r.With(s.rateLimited).Post("/login", s.login)
			r.With(s.rateLimitedPublic).Post("/verify-email", s.verifyEmail)
			r.With(s.rateLimited).Post("/google", s.googleSignIn)
			r.With(s.rateLimited).Post("/firebase", s.firebaseSignIn)
			r.With(s.rateLimitedRefresh).Post("/refresh", s.refresh)
			r.Post("/logout", s.logout)
			r.With(s.rateLimitedPublic).Get("/username-available", s.usernameAvailable)
		})

		// Public browsing (the map works before sign-in).
		r.With(s.rateLimitedPublic).Get("/sports", s.listSports)
		r.With(s.rateLimitedPublic).Get("/courts/nearby", s.courtsNearby)
		r.With(s.rateLimitedPublic).Get("/friend-invites/{token}", s.getFriendInvitePreview)
		r.With(s.rateLimitedPublic).Get("/game-links/{token}", s.getGameSharePreview)
		r.With(s.rateLimitedPublic).Get("/profiles/{username}", s.getPublicProfileByUsername)

		r.Group(func(r chi.Router) {
			r.Use(s.requireActiveUser)

			r.Get("/me", s.getMe)
			r.Patch("/me", s.updateMe)
			r.With(s.rateLimitedUser("court")).Post("/me/password", s.setPassword)
			r.Get("/me/avatar", s.getMyAvatar)
			r.Put("/me/avatar", s.putMyAvatar)
			r.Delete("/me/avatar", s.deleteMyAvatar)
			r.With(s.rateLimitedUser("notify")).Post("/me/notify-area", s.setNotifyArea)
			r.Post("/me/ws-ticket", s.issueWsTicket)
			r.Post("/me/push-tokens", s.registerPushToken)
			r.Delete("/me/push-tokens", s.deletePushToken)
			r.With(s.rateLimitedUser("game")).Post("/me/push-test", s.pushTest)
			r.Get("/me/friends", s.listFriends)
			r.Get("/me/friend-requests", s.listFriendRequests)
			r.Post("/me/friend-requests", s.sendFriendRequest)
			r.Post("/me/friend-requests/{id}/accept", s.acceptFriendRequest)
			r.Post("/me/friend-requests/{id}/reject", s.rejectFriendRequest)
			r.Post("/me/friend-invite-link", s.createFriendInviteLink)
			r.Post("/me/bump", s.bumpConnect)
			r.Delete("/me/bump", s.bumpCancel)
			r.Get("/me/recap", s.getMyRecap)
			r.Get("/me/progress", s.getMyProgress)
			r.Get("/users/{id}/progress", s.getUserProgress)
			r.Get("/kings", s.getKings)
			r.Get("/users/{id}/head-to-head", s.headToHead)
			r.Get("/challenges", s.listChallenges)
			r.With(s.rateLimitedUser("game")).Post("/challenges", s.createChallenge)
			r.Get("/challenges/{id}", s.getChallenge)
			r.Post("/challenges/{id}/accept", s.challengeAction(`select respond_challenge($1, true)`))
			r.Post("/challenges/{id}/decline", s.challengeAction(`select respond_challenge($1, false)`))
			r.Post("/challenges/{id}/cancel", s.challengeAction(`select cancel_challenge($1)`))
			r.Post("/challenges/{id}/result", s.reportChallenge)
			r.With(s.rateLimitedUser("game")).Post("/challenges/{id}/players", s.addChallengePlayer)
			r.Post("/challenges/{id}/confirm", s.challengeAction(`select confirm_challenge($1, true)`))
			r.Post("/challenges/{id}/dispute", s.challengeAction(`select confirm_challenge($1, false)`))
			r.Get("/courts/{id}/challenges", s.openChallengesAtCourt)
			r.With(s.rateLimitedUser("game")).Post("/challenges/{id}/court", s.moveChallenge)
			r.Get("/me/court-changes", s.myCourtChanges)
			r.Post("/me/court-changes/{id}/seen", s.ackCourtChange)
			r.Post("/friend-invites/{token}/accept", s.acceptFriendInviteLink)
			r.Get("/me/games", s.myGames)
			r.Get("/me/presence", s.myPresence)

			r.Get("/users/{id}", s.getUser)

			r.Get("/courts/{id}", s.getCourt)
			r.Get("/courts/rain", s.courtsRain)
			r.Get("/courts/{id}/weather", s.courtWeather)
			r.Get("/courts/{id}/leaderboard", s.courtLeaderboard)
			r.With(s.rateLimitedUser("court")).Post("/courts", s.proposeCourt)
			r.With(s.rateLimitedUser("court")).Post("/courts/{id}/photos", s.addCourtPhotos)
			r.With(s.rateLimitedUser("court")).Delete("/courts/{id}/photos", s.removeCourtPhotos)
			r.With(s.rateLimitedUser("court")).Patch("/courts/{id}/hours", s.patchCourtHours)
			r.With(s.rateLimitedUser("court")).Patch("/courts/{id}/info", s.patchCourtInfo)
			r.Post("/courts/{id}/reports", s.reportCourt)

			r.Get("/games/nearby", s.gamesNearby)
			r.With(s.rateLimitedUser("game")).Post("/games", s.createGame)
			r.Get("/games/{id}", s.getGame)
			r.Patch("/games/{id}", s.updateGame)
			r.With(s.rateLimitedUser("game")).Post("/games/{id}/court", s.moveGame)
			r.Post("/games/{id}/join", s.joinGame)
			r.Post("/games/{id}/leave", s.leaveGame)
			r.Post("/games/{id}/cancel", s.cancelGame)
			r.Post("/games/{id}/invite", s.inviteToGame)
			r.Post("/games/{id}/share-link", s.createGameShareLink)
			r.Get("/games/{id}/scoreboard", s.getScoreboard)
			r.Put("/games/{id}/scoreboard", s.putScoreboard)

			r.Post("/presence", s.markPresent)
			r.Post("/presence/confirm", s.confirmPresence)
			r.Delete("/presence", s.endPresence)

			r.Get("/notifications", s.listNotifications)
			r.Post("/notifications/{id}/read", s.readNotification)
			r.Post("/notifications/read-all", s.readAllNotifications)

			r.Post("/uploads", s.upload)

			r.Route("/admin", func(r chi.Router) {
				r.Use(s.requireAdmin)
				r.Get("/stats", s.adminStats)
				r.Get("/courts", s.adminCourts)
				r.Get("/courts/{id}", s.adminGetCourt)
				r.Post("/courts", s.adminCreateCourt)
				r.Patch("/courts/{id}", s.adminUpdateCourt)
				r.Post("/courts/{id}/review", s.adminReviewCourt)
				r.Delete("/courts/{id}", s.adminDeleteCourt)
				r.Get("/games", s.adminGames)
				r.Post("/games/{id}/cancel", s.cancelGame)
				r.Delete("/games/{id}", s.adminDeleteGame)
				r.Get("/users", s.adminUsers)
				r.Post("/users/{id}/suspend", s.adminSuspendUser)
				r.Delete("/users/{id}", s.adminDeleteUser)
				r.Get("/reports", s.adminReports)
				r.Post("/reports/{id}/resolve", s.adminResolveReport)
				r.Get("/settings", s.adminSettings)
				r.Patch("/settings", s.adminUpdateSettings)
			})
		})
	})
	return r
}

// ---------------------------------------------------------------------------
// Auth context
// ---------------------------------------------------------------------------

type ctxKey int

const userKey ctxKey = 1

type principal struct {
	ID   string
	Role string
}

func (s *Server) authenticate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/ws" {
			if ticket := strings.TrimSpace(r.URL.Query().Get("ticket")); ticket != "" {
				var userID, role string
				err := s.db.Pool.QueryRow(r.Context(),
					`with u as (select public.consume_ws_ticket($1) as id)
					 select u.id, usr.role::text from u join public.users usr on usr.id = u.id where u.id is not null`,
					ticket).Scan(&userID, &role)
				if err == nil && userID != "" {
					r = r.WithContext(context.WithValue(r.Context(), userKey, principal{ID: userID, Role: role}))
					next.ServeHTTP(w, r)
					return
				}
			}
			next.ServeHTTP(w, r)
			return
		}
		if tok := accessTokenFromRequest(r); tok != "" {
			claims, err := s.tokens.Verify(tok)
			if err == nil {
				r = r.WithContext(context.WithValue(r.Context(), userKey, principal{ID: claims.Subject, Role: claims.Role}))
			}
			// Expired or invalid tokens are ignored here; protected routes still require a valid user.
		}
		next.ServeHTTP(w, r)
	})
}

func currentUser(r *http.Request) (principal, bool) {
	p, ok := r.Context().Value(userKey).(principal)
	return p, ok
}

func uid(r *http.Request) string {
	p, _ := currentUser(r)
	return p.ID
}

// requireActiveUser rejects anonymous requests and, because access tokens
// outlive moderation actions, re-checks that the account still exists and is
// not suspended.
func (s *Server) requireActiveUser(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p, ok := currentUser(r)
		if !ok {
			writeError(w, http.StatusUnauthorized, "not_authenticated", "Please sign in.")
			return
		}
		var suspended bool
		var active bool
		err := s.db.Pool.QueryRow(r.Context(), `
			select suspended_at is not null,
			       (email_verified_at is not null or password_hash is null) as active_ok
			from users where id = $1`, p.ID).Scan(&suspended, &active)
		switch {
		case db.IsNoRows(err):
			writeError(w, http.StatusUnauthorized, "not_authenticated", "Please sign in.")
			return
		case err != nil:
			writeDBError(w, r, err)
			return
		case suspended:
			writeError(w, http.StatusForbidden, "suspended", "This account is suspended.")
			return
		case !active:
			writeError(w, http.StatusForbidden, "email_not_verified", "Verify your email before using the app.")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// requireAdmin re-checks the database, so demoting or suspending an admin
// takes effect immediately rather than when their token expires.
func (s *Server) requireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var ok bool
		err := s.db.Pool.QueryRow(r.Context(),
			"select exists(select 1 from users where id=$1 and role='admin' and suspended_at is null)", uid(r)).Scan(&ok)
		if err != nil || !ok {
			writeError(w, http.StatusForbidden, "admin_only", "Admins only.")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) handleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		OriginPatterns: s.originPatterns(s.cfg.CORSOrigins),
	})
	if err != nil {
		return
	}
	s.hub.Serve(r.Context(), conn, uid(r))
}

func (s *Server) originPatterns(origins []string) []string {
	var out []string
	seen := map[string]bool{}
	if s.cfg.AllowVercelPreviews {
		out = append(out, "*.vercel.app")
		seen["*.vercel.app"] = true
	}
	for _, o := range origins {
		o = strings.TrimPrefix(strings.TrimPrefix(o, "https://"), "http://")
		if o != "" && !seen[o] {
			seen[o] = true
			out = append(out, o)
		}
	}
	return out
}

// corsAllowed matches configured origins and optionally https://*.vercel.app previews.
func (s *Server) corsAllowed(allowed []string, origin string) bool {
	origin = strings.TrimSpace(origin)
	if origin == "" {
		return false
	}
	for _, a := range allowed {
		if strings.EqualFold(a, origin) {
			return true
		}
	}
	u, err := url.Parse(origin)
	if err != nil || u.Scheme != "https" {
		return false
	}
	if !s.cfg.AllowVercelPreviews {
		return false
	}
	host := strings.ToLower(u.Hostname())
	return strings.HasSuffix(host, ".vercel.app") || host == "vercel.app"
}

// ---------------------------------------------------------------------------
// JSON helpers
// ---------------------------------------------------------------------------

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeRaw(w http.ResponseWriter, status int, b []byte) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write(b)
}

type apiError struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

func writeError(w http.ResponseWriter, status int, code, msg string) {
	writeJSON(w, status, apiError{Error: code, Message: msg})
}

func readJSON(w http.ResponseWriter, r *http.Request, dst any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "Invalid request body.")
		return false
	}
	return true
}

// Human-readable messages for SQL business errors.
var appErrors = map[string]struct {
	status int
	msg    string
}{
	"not_authenticated":          {http.StatusUnauthorized, "Please sign in."},
	"admin_only":                 {http.StatusForbidden, "Admins only."},
	"not_allowed":                {http.StatusForbidden, "You can't do that."},
	"use_cancel_game":            {http.StatusForbidden, "Use cancel to stop a game."},
	"game_not_found":             {http.StatusNotFound, "Game not found."},
	"court_not_found":            {http.StatusNotFound, "Court not found."},
	"user_not_found":             {http.StatusNotFound, "No player with that username."},
	"already_friends":            {http.StatusConflict, "You're already friends with that player."},
	"request_pending":            {http.StatusConflict, "Friend request already sent."},
	"invite_not_found":           {http.StatusNotFound, "This invite link is invalid or expired."},
	"report_not_found":           {http.StatusNotFound, "Report not found."},
	"already_joined":             {http.StatusConflict, "You're already in this game."},
	"game_full":                  {http.StatusConflict, "This game is full."},
	"game_closed":                {http.StatusConflict, "This game is no longer open."},
	"removed_from_game":          {http.StatusConflict, "You were removed from this game."},
	"not_in_game":                {http.StatusConflict, "You're not in this game."},
	"no_active_presence":         {http.StatusConflict, "You're not checked in anywhere."},
	"too_far_from_court":         {http.StatusUnprocessableEntity, "You need to be at the court to check in."},
	"location_required":          {http.StatusUnprocessableEntity, "Turn on location to check in."},
	"court_not_available":        {http.StatusUnprocessableEntity, "This court isn't available."},
	"sport_not_offered_at_court": {http.StatusUnprocessableEntity, "That sport isn't played at this court."},
	"sport_locked":               {http.StatusForbidden, "Your sport was set at signup and can't be changed."},
	"wrong_sport":                {http.StatusForbidden, "You can only use your chosen sport."},
	"start_time_in_past":         {http.StatusUnprocessableEntity, "Start time is in the past."},
	"start_time_too_far":         {http.StatusUnprocessableEntity, "Start time must be within 30 days."},
	"max_players_below_current":  {http.StatusUnprocessableEntity, "More players have already joined."},
	"cannot_suspend_self":        {http.StatusUnprocessableEntity, "You can't suspend yourself."},
	"invalid_input":              {http.StatusUnprocessableEntity, "Invalid input."},
	"invalid_reference":          {http.StatusUnprocessableEntity, "Something referenced doesn't exist."},
	"token_in_use":               {http.StatusConflict, "This device is registered to another account."},
	"notify_jump_too_far":        {http.StatusUnprocessableEntity, "Move your alert area gradually or check in at a court first."},
	"notify_rate_limited":        {http.StatusTooManyRequests, "You can change your alert area again in a few minutes."},
	"browse_location_mismatch":   {http.StatusUnprocessableEntity, "Map center is too far from your alert area. Update alerts or check in nearby."},
	"too_many_pending_courts":    {http.StatusUnprocessableEntity, "You already have pending court proposals. Wait for review."},
	"invalid_location":           {http.StatusUnprocessableEntity, "Invalid coordinates."},
	"challenge_not_found":        {http.StatusNotFound, "Challenge not found."},
	"same_court":                 {http.StatusUnprocessableEntity, "That's already the court."},
	"challenge_closed":           {http.StatusConflict, "This challenge is no longer open."},
	"challenge_pending":          {http.StatusConflict, "You already have a pending challenge with this player."},
	"too_many_challenges":        {http.StatusTooManyRequests, "Too many open challenges. Wait for answers first."},
	"side_full":                  {http.StatusConflict, "This side is already full."},
	"already_invited":            {http.StatusConflict, "That player is already in this challenge."},
	"result_awaiting_you":        {http.StatusConflict, "The other player reported a result — confirm or dispute it."},
	"game_not_started":           {http.StatusUnprocessableEntity, "Scores and stats can be added once the game has started."},
}

// writeDBError maps errors from the SQL layer to HTTP responses.
func writeDBError(w http.ResponseWriter, r *http.Request, err error) {
	if db.IsNoRows(err) {
		writeError(w, http.StatusNotFound, "not_found", "Not found.")
		return
	}
	if code, ok := db.AppError(err); ok {
		if e, ok := appErrors[code]; ok {
			writeError(w, e.status, code, e.msg)
			return
		}
		switch {
		case strings.HasPrefix(code, "already_exists:"):
			msg := "That already exists."
			if strings.Contains(code, "username") {
				msg = "That username is taken."
			} else if strings.Contains(code, "email") {
				msg = "An account with that email already exists."
			}
			writeError(w, http.StatusConflict, "already_exists", msg)
			return
		case strings.HasPrefix(code, "invalid:"):
			writeError(w, http.StatusUnprocessableEntity, "invalid", "Invalid value: "+strings.TrimPrefix(code, "invalid:"))
			return
		}
	}
	if errors.Is(err, context.Canceled) {
		return
	}
	slog.Error("request failed", "path", r.URL.Path, "err", err)
	writeError(w, http.StatusInternalServerError, "internal", "Something went wrong.")
}

func noDirListing(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "" || strings.HasSuffix(r.URL.Path, "/") {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		h.ServeHTTP(w, r)
	})
}

// ---------------------------------------------------------------------------
// Rate limiting (per IP, fixed window) for auth endpoints
// ---------------------------------------------------------------------------

type rateLimiter struct {
	mu     sync.Mutex
	max    int
	window time.Duration
	hits   map[string]*window
}

type window struct {
	start time.Time
	n     int
}

func newRateLimiter(max int, per time.Duration) *rateLimiter {
	return &rateLimiter{max: max, window: per, hits: map[string]*window{}}
}

func (l *rateLimiter) allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	if len(l.hits) > 10000 {
		for k, v := range l.hits {
			if now.Sub(v.start) > l.window {
				delete(l.hits, k)
			}
		}
	}
	h, ok := l.hits[key]
	if !ok || now.Sub(h.start) > l.window {
		l.hits[key] = &window{start: now, n: 1}
		return true
	}
	h.n++
	return h.n <= l.max
}

func (s *Server) rateLimited(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := s.clientIP(r)
		if !s.dbRateLimit(r.Context(), "auth", ip, 30, 60) {
			writeError(w, http.StatusTooManyRequests, "rate_limited", "Too many attempts. Try again in a minute.")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) rateLimitedRefresh(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := s.clientIP(r)
		if !s.dbRateLimit(r.Context(), "refresh", ip, 60, 60) {
			writeError(w, http.StatusTooManyRequests, "rate_limited", "Too many attempts. Try again in a minute.")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) rateLimitedPublic(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := s.clientIP(r)
		if !s.dbRateLimit(r.Context(), "browse", ip, 90, 60) || !s.browseLimit.allow(ip) {
			writeError(w, http.StatusTooManyRequests, "rate_limited", "Too many requests. Try again in a minute.")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) rateLimitedUser(bucket string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			id := uid(r)
			lim := s.userGameLimit
			switch bucket {
			case "court":
				lim = s.userCourtLimit
			case "notify":
				lim = s.userNotifyLimit
			}
			if id != "" && !lim.allow(id) {
				writeError(w, http.StatusTooManyRequests, "rate_limited", "Too many requests. Try again later.")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
