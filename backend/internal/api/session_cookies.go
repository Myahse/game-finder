package api

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	cookieAccess  = "ftg_access"
	cookieRefresh = "ftg_refresh"
)

func (s *Server) setSessionCookies(w http.ResponseWriter, r *http.Request, access, refresh string, accessExp, refreshExp time.Time) {
	secure := s.cookieSecure(r)
	http.SetCookie(w, &http.Cookie{
		Name:     cookieAccess,
		Value:    access,
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
		Expires:  accessExp,
	})
	http.SetCookie(w, &http.Cookie{
		Name:     cookieRefresh,
		Value:    refresh,
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
		Expires:  refreshExp,
	})
}

func (s *Server) clearSessionCookies(w http.ResponseWriter, r *http.Request) {
	secure := s.cookieSecure(r)
	expired := time.Unix(0, 0)
	for _, name := range []string{cookieAccess, cookieRefresh} {
		http.SetCookie(w, &http.Cookie{
			Name:     name,
			Value:    "",
			Path:     "/",
			HttpOnly: true,
			Secure:   secure,
			SameSite: http.SameSiteLaxMode,
			MaxAge:   -1,
			Expires:  expired,
		})
	}
}

func (s *Server) cookieSecure(r *http.Request) bool {
	if r.TLS != nil {
		return true
	}
	if strings.HasPrefix(strings.ToLower(s.cfg.PublicBaseURL), "https://") {
		return true
	}
	if fwd := r.Header.Get("X-Forwarded-Proto"); strings.EqualFold(fwd, "https") {
		return true
	}
	return false
}

func accessTokenFromRequest(r *http.Request) string {
	if c, err := r.Cookie(cookieAccess); err == nil && strings.TrimSpace(c.Value) != "" {
		return strings.TrimSpace(c.Value)
	}
	if h := r.Header.Get("Authorization"); strings.HasPrefix(h, "Bearer ") {
		return strings.TrimSpace(strings.TrimPrefix(h, "Bearer "))
	}
	return ""
}

func refreshTokenFromRequest(r *http.Request) string {
	if c, err := r.Cookie(cookieRefresh); err == nil && strings.TrimSpace(c.Value) != "" {
		return strings.TrimSpace(c.Value)
	}
	if r.Body == nil || r.ContentLength == 0 {
		return ""
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil || len(body) == 0 {
		return ""
	}
	var in struct {
		RefreshToken string `json:"refresh_token"`
	}
	if json.Unmarshal(body, &in) != nil {
		return ""
	}
	return strings.TrimSpace(in.RefreshToken)
}
