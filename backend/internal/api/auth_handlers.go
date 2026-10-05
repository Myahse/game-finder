package api

import (
	"context"
	"log/slog"
	"net/http"
	"net/url"
	"regexp"
	"slices"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"findthegame/backend/internal/auth"
)

var (
	usernameRe = regexp.MustCompile(`^[A-Za-z0-9_.]{3,24}$`)
	emailRe    = regexp.MustCompile(`^[^@\s]+@[^@\s]+\.[^@\s]+$`)
)

type session struct {
	AccessToken      string    `json:"access_token"`
	AccessExpiresAt  time.Time `json:"access_expires_at"`
	RefreshToken     string    `json:"refresh_token"`
	RefreshExpiresAt time.Time `json:"refresh_expires_at"`
	User             rawJSON   `json:"user"`
}

type rawJSON []byte

func (r rawJSON) MarshalJSON() ([]byte, error) {
	if len(r) == 0 {
		return []byte("null"), nil
	}
	return r, nil
}

func (s *Server) register(w http.ResponseWriter, r *http.Request) {
	if !s.cfg.PasswordRegistration {
		writeError(w, http.StatusForbidden, "password_registration_disabled",
			"Email sign-up is disabled. Use Google sign-in instead.")
		return
	}
	var in struct {
		FirstName         string `json:"first_name"`
		LastName          string `json:"last_name"`
		Username          string `json:"username"`
		Email             string `json:"email"`
		Password          string `json:"password"`
		AvatarURL         string `json:"avatar_url"`
		FriendInviteToken string `json:"friend_invite_token"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	in.FirstName, in.LastName = strings.TrimSpace(in.FirstName), strings.TrimSpace(in.LastName)
	in.Username, in.Email = strings.TrimSpace(in.Username), strings.ToLower(strings.TrimSpace(in.Email))
	switch {
	case in.FirstName == "" || len(in.FirstName) > 50:
		writeError(w, http.StatusUnprocessableEntity, "invalid_first_name", "Enter your first name.")
		return
	case in.LastName == "" || len(in.LastName) > 50:
		writeError(w, http.StatusUnprocessableEntity, "invalid_last_name", "Enter your last name.")
		return
	case !usernameRe.MatchString(in.Username):
		writeError(w, http.StatusUnprocessableEntity, "invalid_username", "Username: 3–24 letters, numbers, _ or .")
		return
	case !emailRe.MatchString(in.Email):
		writeError(w, http.StatusUnprocessableEntity, "invalid_email", "Enter a valid email.")
		return
	case len(in.Password) < 8 || len(in.Password) > 72:
		writeError(w, http.StatusUnprocessableEntity, "weak_password", "Password must be 8–72 characters.")
		return
	case in.AvatarURL != "" && !s.allowedUploadURL(in.AvatarURL):
		writeError(w, http.StatusUnprocessableEntity, "invalid_photo_url", "Avatar must be uploaded through the app.")
		return
	}
	hash, err := auth.HashPassword(in.Password)
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	role := "user"
	if slices.Contains(s.cfg.AdminEmails, in.Email) {
		role = "admin"
	}

	needsVerify := s.mailer.Enabled()
	var userID string
	err = s.db.Tx(r.Context(), "", func(tx pgx.Tx) error {
		return tx.QueryRow(r.Context(), `
			insert into users (email, password_hash, first_name, last_name, username, avatar_url, role, email_verified_at)
			values ($1, $2, $3, $4, $5, nullif($6, ''), $7, case when $8::boolean then null else now() end)
			returning id`,
			in.Email, hash, in.FirstName, in.LastName, in.Username, in.AvatarURL, role, needsVerify).Scan(&userID)
	})
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	if needsVerify {
		s.sendVerificationEmail(r.Context(), userID, in.Email)
	}
	s.applyFriendInviteToken(r.Context(), userID, in.FriendInviteToken)
	s.issueSession(w, r, userID, role, http.StatusCreated)
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Login    string `json:"login"`
		Email    string `json:"email"` // legacy clients
		Password string `json:"password"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	ident := strings.TrimSpace(in.Login)
	if ident == "" {
		ident = strings.TrimSpace(in.Email)
	}
	if ident == "" || in.Password == "" {
		writeError(w, http.StatusUnprocessableEntity, "invalid_credentials", "Enter your username or email and password.")
		return
	}
	var id, hash, role string
	var suspended, emailVerified bool
	err := s.db.Pool.QueryRow(r.Context(), `
		select id, coalesce(password_hash, ''), role::text, suspended_at is not null,
		       email_verified_at is not null
		from users
		where email = lower($1) or username = $1::citext`,
		ident).Scan(&id, &hash, &role, &suspended, &emailVerified)
	if err != nil {
		auth.BurnPasswordCheck(in.Password)
		writeError(w, http.StatusUnauthorized, "invalid_credentials", "Wrong username, email, or password.")
		return
	}
	if hash != "" && !emailVerified {
		writeError(w, http.StatusForbidden, "email_not_verified", "Verify your email before signing in.")
		return
	}
	if !auth.CheckPassword(hash, in.Password) {
		writeError(w, http.StatusUnauthorized, "invalid_credentials", "Wrong username, email, or password.")
		return
	}
	if suspended {
		writeError(w, http.StatusForbidden, "suspended", "This account is suspended.")
		return
	}
	s.issueSession(w, r, id, role, http.StatusOK)
}

// refresh rotates the refresh token: the old one is revoked on use.
func (s *Server) refresh(w http.ResponseWriter, r *http.Request) {
	raw := refreshTokenFromRequest(r)
	if raw == "" {
		writeError(w, http.StatusUnauthorized, "invalid_refresh_token", "Session expired. Please sign in again.")
		return
	}
	var userID, role string
	var suspended bool
	hash := auth.HashToken(raw)
	err := s.db.Pool.QueryRow(r.Context(), `
		update refresh_tokens t set revoked_at = now()
		from users u
		where t.token_hash = $1 and t.revoked_at is null and t.expires_at > now() and u.id = t.user_id
		returning u.id, u.role::text, u.suspended_at is not null`,
		hash).Scan(&userID, &role, &suspended)
	if err != nil {
		var reuseUser string
		_ = s.db.Pool.QueryRow(r.Context(),
			`select user_id from refresh_tokens where token_hash = $1 and revoked_at is not null limit 1`, hash).Scan(&reuseUser)
		if reuseUser != "" {
			_, _ = s.db.Pool.Exec(r.Context(),
				`update refresh_tokens set revoked_at = now() where user_id = $1 and revoked_at is null`, reuseUser)
			slog.Warn("refresh token reuse detected; revoked active sessions", "user_id", reuseUser)
		}
		writeError(w, http.StatusUnauthorized, "invalid_refresh_token", "Session expired. Please sign in again.")
		return
	}
	if suspended {
		writeError(w, http.StatusForbidden, "suspended", "This account is suspended.")
		return
	}
	s.issueSession(w, r, userID, role, http.StatusOK)
}

func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	if raw := refreshTokenFromRequest(r); raw != "" {
		_, _ = s.db.Pool.Exec(r.Context(),
			"update refresh_tokens set revoked_at = now() where token_hash = $1 and revoked_at is null",
			auth.HashToken(raw))
	}
	s.clearSessionCookies(w, r)
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) verifyEmail(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Token string `json:"token"`
	}
	if !readJSON(w, r, &in) || strings.TrimSpace(in.Token) == "" {
		writeError(w, http.StatusBadRequest, "invalid_token", "Verification link is invalid.")
		return
	}
	var userID *string
	err := s.db.Pool.QueryRow(r.Context(),
		`select public.consume_email_verification($1)`, strings.TrimSpace(in.Token)).Scan(&userID)
	if err != nil || userID == nil || *userID == "" {
		writeError(w, http.StatusUnprocessableEntity, "invalid_token", "This verification link is invalid or expired.")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"verified": true})
}

func (s *Server) sendVerificationEmail(ctx context.Context, userID, email string) {
	if s.mailer == nil || !s.mailer.Enabled() {
		return
	}
	var raw string
	if err := s.db.Pool.QueryRow(ctx, `select public.issue_email_verification($1)`, userID).Scan(&raw); err != nil {
		slog.Warn("issue email verification", "err", err)
		return
	}
	base := strings.TrimRight(s.cfg.WebAppURL, "/")
	if base == "" && len(s.cfg.CORSOrigins) > 0 {
		base = strings.TrimRight(s.cfg.CORSOrigins[0], "/")
	}
	if base == "" {
		slog.Warn("WEB_APP_URL unset; cannot send verification email")
		return
	}
	link := base + "/verify-email?token=" + url.QueryEscape(raw)
	if err := s.mailer.SendVerification(ctx, email, link); err != nil {
		slog.Warn("send verification email", "err", err, "email", email)
	}
}

func (s *Server) usernameAvailable(w http.ResponseWriter, r *http.Request) {
	u := strings.TrimSpace(r.URL.Query().Get("username"))
	var ok bool
	exclude := uid(r)
	if exclude != "" {
		if err := s.db.Pool.QueryRow(r.Context(), "select username_available($1, $2::uuid)", u, exclude).Scan(&ok); err != nil {
			writeDBError(w, r, err)
			return
		}
	} else {
		if err := s.db.Pool.QueryRow(r.Context(), "select username_available($1, null)", u).Scan(&ok); err != nil {
			writeDBError(w, r, err)
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]bool{"available": ok})
}

func (s *Server) issueSession(w http.ResponseWriter, r *http.Request, userID, role string, status int) {
	access, accessExp, err := s.tokens.AccessToken(userID, role)
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	refresh, hash, err := auth.NewRefreshToken()
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	refreshExp := time.Now().Add(s.cfg.RefreshTokenTTL)
	if _, err := s.db.Pool.Exec(r.Context(),
		"insert into refresh_tokens (user_id, token_hash, expires_at) values ($1, $2, $3)",
		userID, hash, refreshExp); err != nil {
		writeDBError(w, r, err)
		return
	}
	me, err := s.meJSON(r.Context(), userID)
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	s.setSessionCookies(w, r, access, refresh, accessExp, refreshExp)
	writeJSON(w, status, session{
		AccessToken: access, AccessExpiresAt: accessExp,
		RefreshToken: refresh, RefreshExpiresAt: refreshExp,
		User: me,
	})
}

const meSQL = `
	select json_build_object(
		'id', u.id, 'email', u.email, 'first_name', u.first_name, 'last_name', u.last_name,
		'username', u.username, 'avatar_url', u.avatar_url, 'avatar_config', u.avatar_config,
		'player_avatar', (select ua.config from user_avatars ua where ua.user_id = u.id),
		'player_avatar_public',
			(select ua.config from user_avatars ua where ua.user_id = u.id and ua.use_as_profile),
		'preferred_sport_id', u.preferred_sport_id, 'skill_level', u.skill_level,
		'extra_sport_ids', coalesce((
			select json_agg(ues.sport_id::text order by ues.created_at)
			from user_extra_sports ues where ues.user_id = u.id
		), '[]'::json),
		'role', u.role, 'onboarded', u.onboarded_at is not null, 'created_at', u.created_at,
		'stats', (select row_to_json(ps) from profile_stats(u.id) ps)
	)
	from users u where u.id = $1`

func (s *Server) meJSON(ctx context.Context, userID string) ([]byte, error) {
	return s.db.JSON(ctx, userID, meSQL, userID)
}
