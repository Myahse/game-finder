package api

import (
	"context"
	"net/http"
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
	var in struct {
		FirstName string `json:"first_name"`
		LastName  string `json:"last_name"`
		Username  string `json:"username"`
		Email     string `json:"email"`
		Password  string `json:"password"`
		AvatarURL string `json:"avatar_url"`
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

	var userID string
	err = s.db.Tx(r.Context(), "", func(tx pgx.Tx) error {
		return tx.QueryRow(r.Context(), `
			insert into users (email, password_hash, first_name, last_name, username, avatar_url, role)
			values ($1, $2, $3, $4, $5, nullif($6, ''), $7)
			returning id`,
			in.Email, hash, in.FirstName, in.LastName, in.Username, in.AvatarURL, role).Scan(&userID)
	})
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	s.issueSession(w, r, userID, role, http.StatusCreated)
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	var id, hash, role string
	var suspended bool
	err := s.db.Pool.QueryRow(r.Context(),
		"select id, password_hash, role::text, suspended_at is not null from users where email = $1",
		strings.ToLower(strings.TrimSpace(in.Email))).Scan(&id, &hash, &role, &suspended)
	if err != nil {
		auth.BurnPasswordCheck(in.Password)
		writeError(w, http.StatusUnauthorized, "invalid_credentials", "Wrong email or password.")
		return
	}
	if !auth.CheckPassword(hash, in.Password) {
		writeError(w, http.StatusUnauthorized, "invalid_credentials", "Wrong email or password.")
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
	var in struct {
		RefreshToken string `json:"refresh_token"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	var userID, role string
	var suspended bool
	err := s.db.Pool.QueryRow(r.Context(), `
		update refresh_tokens t set revoked_at = now()
		from users u
		where t.token_hash = $1 and t.revoked_at is null and t.expires_at > now() and u.id = t.user_id
		returning u.id, u.role::text, u.suspended_at is not null`,
		auth.HashToken(in.RefreshToken)).Scan(&userID, &role, &suspended)
	if err != nil {
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
	var in struct {
		RefreshToken string `json:"refresh_token"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	_, _ = s.db.Pool.Exec(r.Context(),
		"update refresh_tokens set revoked_at = now() where token_hash = $1 and revoked_at is null",
		auth.HashToken(in.RefreshToken))
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) usernameAvailable(w http.ResponseWriter, r *http.Request) {
	var ok bool
	if err := s.db.Pool.QueryRow(r.Context(), "select username_available($1)", r.URL.Query().Get("username")).Scan(&ok); err != nil {
		writeDBError(w, r, err)
		return
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
	writeJSON(w, status, session{
		AccessToken: access, AccessExpiresAt: accessExp,
		RefreshToken: refresh, RefreshExpiresAt: refreshExp,
		User: me,
	})
}

const meSQL = `
	select json_build_object(
		'id', u.id, 'email', u.email, 'first_name', u.first_name, 'last_name', u.last_name,
		'username', u.username, 'avatar_url', u.avatar_url,
		'preferred_sport_id', u.preferred_sport_id, 'skill_level', u.skill_level,
		'role', u.role, 'onboarded', u.onboarded_at is not null, 'created_at', u.created_at,
		'stats', (select row_to_json(ps) from profile_stats(u.id) ps)
	)
	from users u where u.id = $1`

func (s *Server) meJSON(ctx context.Context, userID string) ([]byte, error) {
	return s.db.JSON(ctx, userID, meSQL, userID)
}
