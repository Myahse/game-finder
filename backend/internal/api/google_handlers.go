package api

import (
	"crypto/rand"
	"errors"
	"fmt"
	"log/slog"
	"math/big"
	"net/http"
	"slices"
	"strings"
	"unicode"

	"github.com/jackc/pgx/v5"

	"findthegame/backend/internal/auth"
)

// googleSignIn exchanges a Google ID token (from Google Identity Services on
// the web or google_sign_in on mobile) for a Find the Game session.
//
//   - known Google account          → sign in
//   - email matches an account      → link Google to it, sign in
//   - new                           → create the account (onboarding follows)
func (s *Server) googleSignIn(w http.ResponseWriter, r *http.Request) {
	if !s.google.Enabled() {
		writeError(w, http.StatusServiceUnavailable, "google_not_configured", "Google sign-in isn't available.")
		return
	}
	var in struct {
		IDToken           string `json:"id_token"`
		FriendInviteToken string `json:"friend_invite_token"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	if in.IDToken == "" || len(in.IDToken) > 8192 {
		writeError(w, http.StatusUnprocessableEntity, "invalid_google_token", "Google sign-in failed. Try again.")
		return
	}
	id, err := s.google.Verify(r.Context(), in.IDToken)
	if err != nil {
		slog.Warn("google token rejected", "err", err)
		writeError(w, http.StatusUnauthorized, "invalid_google_token", "Google sign-in failed. Try again.")
		return
	}
	s.oauthFederatedIdentity(w, r, id, in.FriendInviteToken)
}

var errOAuthMismatch = errors.New("oauth account mismatch")

func (s *Server) oauthFederatedIdentity(w http.ResponseWriter, r *http.Request, id *auth.GoogleIdentity, friendInviteToken string) {
	if id.Provider == "" {
		id.Provider = "google"
	}
	if id.Email == "" {
		writeError(w, http.StatusUnprocessableEntity, "oauth_email_required",
			"We need an email from your sign-in provider. Try again and allow email sharing.")
		return
	}
	if id.Provider == "google" && !id.EmailVerified {
		writeError(w, http.StatusUnprocessableEntity, "google_email_unverified", "Your Google account email isn't verified.")
		return
	}

	var userID, role string
	var suspended, created bool
	err := s.db.Tx(r.Context(), "", func(tx pgx.Tx) error {
		// 1. Already linked to this provider.
		var linkErr error
		switch id.Provider {
		case "google":
			linkErr = tx.QueryRow(r.Context(),
				`select id, role::text, suspended_at is not null from users where google_sub = $1`,
				id.Subject).Scan(&userID, &role, &suspended)
		case "apple":
			linkErr = tx.QueryRow(r.Context(),
				`select id, role::text, suspended_at is not null from users where apple_sub = $1`,
				id.Subject).Scan(&userID, &role, &suspended)
		default:
			return errors.New("unsupported oauth provider")
		}
		if linkErr == nil || !errors.Is(linkErr, pgx.ErrNoRows) {
			return linkErr
		}

		// 2. Same email: link provider id.
		var googleSub, appleSub *string
		err := tx.QueryRow(r.Context(),
			`select id, role::text, suspended_at is not null, google_sub, apple_sub from users where email = $1 for update`,
			id.Email).Scan(&userID, &role, &suspended, &googleSub, &appleSub)
		switch {
		case err == nil && id.Provider == "google" && googleSub != nil && *googleSub != id.Subject:
			return errOAuthMismatch
		case err == nil && id.Provider == "apple" && appleSub != nil && *appleSub != id.Subject:
			return errOAuthMismatch
		case err == nil:
			switch id.Provider {
			case "google":
				_, err = tx.Exec(r.Context(), `update users set google_sub = $1 where id = $2`, id.Subject, userID)
			case "apple":
				_, err = tx.Exec(r.Context(), `update users set apple_sub = $1 where id = $2`, id.Subject, userID)
			}
			return err
		case !errors.Is(err, pgx.ErrNoRows):
			return err
		}

		// 3. New player.
		created = true
		role = "user"
		if slices.Contains(s.cfg.AdminEmails, id.Email) {
			role = "admin"
		}
		first, last := googleNames(id.GivenName, id.FamilyName, id.Name, id.Email)
		base := usernameBase(id.Email)
		var gSub, aSub *string
		if id.Provider == "google" {
			gSub = &id.Subject
		} else {
			aSub = &id.Subject
		}
		for attempt := 0; attempt < 8; attempt++ {
			candidate := base
			if attempt > 0 {
				candidate = fmt.Sprintf("%s%d", trimRunes(base, 19), randDigits(4))
			}
			err = tx.QueryRow(r.Context(), `
				insert into users (email, password_hash, google_sub, apple_sub, first_name, last_name, username, role)
				values ($1, null, $2, $3, $4, $5, $6, $7)
				on conflict (username) do nothing
				returning id`,
				id.Email, gSub, aSub, first, last, candidate, role).Scan(&userID)
			if !errors.Is(err, pgx.ErrNoRows) {
				return err
			}
		}
		return errors.New("could not allocate a username")
	})
	if errors.Is(err, errOAuthMismatch) {
		code := "google_account_mismatch"
		msg := "This email is linked to a different Google account. Log in with your password."
		if id.Provider == "apple" {
			code = "apple_account_mismatch"
			msg = "This email is linked to a different Apple ID. Log in with your password."
		}
		writeError(w, http.StatusConflict, code, msg)
		return
	}
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	if suspended {
		writeError(w, http.StatusForbidden, "suspended", "This account is suspended.")
		return
	}
	status := http.StatusOK
	if created {
		status = http.StatusCreated
	}
	s.applyFriendInviteToken(r.Context(), userID, friendInviteToken)
	s.issueSession(w, r, userID, role, status)
}

// googleNames picks first/last names that fit the users table.
func googleNames(given, family, full, email string) (string, string) {
	given, family = strings.TrimSpace(given), strings.TrimSpace(family)
	if given == "" {
		parts := strings.Fields(full)
		if len(parts) > 0 {
			given = parts[0]
			if family == "" && len(parts) > 1 {
				family = strings.Join(parts[1:], " ")
			}
		}
	}
	if given == "" {
		given, _, _ = strings.Cut(email, "@")
	}
	if given == "" {
		given = "Player"
	}
	return trimRunes(given, 50), trimRunes(family, 50)
}

// usernameBase derives a valid username (3–24 of [A-Za-z0-9_.]) from an email.
func usernameBase(email string) string {
	local, _, _ := strings.Cut(email, "@")
	var b strings.Builder
	for _, r := range strings.ToLower(local) {
		if r < unicode.MaxASCII && (unicode.IsLetter(r) || unicode.IsDigit(r) || r == '_' || r == '.') {
			b.WriteRune(r)
		}
	}
	u := strings.Trim(b.String(), ".")
	if len(u) < 3 {
		u = "player" + u
	}
	return trimRunes(u, 24)
}

func trimRunes(s string, n int) string {
	r := []rune(s)
	if len(r) > n {
		return string(r[:n])
	}
	return s
}

func randDigits(n int) int64 {
	max := big.NewInt(1)
	for range n {
		max.Mul(max, big.NewInt(10))
	}
	v, err := rand.Int(rand.Reader, max)
	if err != nil {
		return 0
	}
	return v.Int64()
}
