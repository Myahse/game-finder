package api

import (
	"context"
	"net/http"
	"strings"

	"findthegame/backend/internal/db"
)

// requestLocale picks "fr" or "en" from Accept-Language (the device language);
// "" when neither is listed.
func requestLocale(r *http.Request) string {
	for _, part := range strings.Split(r.Header.Get("Accept-Language"), ",") {
		tag := strings.ToLower(strings.TrimSpace(strings.SplitN(part, ";", 2)[0]))
		switch {
		case tag == "fr" || strings.HasPrefix(tag, "fr-"):
			return "fr"
		case tag == "en" || strings.HasPrefix(tag, "en-"):
			return "en"
		}
	}
	return ""
}

func withRequestLocale(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if loc := requestLocale(r); loc != "" {
			r = r.WithContext(db.WithLocale(r.Context(), loc))
		}
		next.ServeHTTP(w, r)
	})
}

// rememberLocale stores the player's device language so notifications created
// for them later (by other players or jobs) are written in it.
func (s *Server) rememberLocale(ctx context.Context, userID string) {
	loc := db.LocaleFrom(ctx)
	if userID == "" || loc == "" {
		return
	}
	_, _ = s.db.Pool.Exec(ctx, `update users set locale = $2 where id = $1 and locale is distinct from $2`, userID, loc)
}
