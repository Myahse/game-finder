package api

import (
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
)

func normalizeProfileUsername(raw string) string {
	return strings.TrimPrefix(strings.TrimSpace(raw), "@")
}

// Public profile for share links (/u/:username). Username match is case-insensitive (citext).
func (s *Server) getPublicProfileByUsername(w http.ResponseWriter, r *http.Request) {
	username := normalizeProfileUsername(chi.URLParam(r, "username"))
	if username == "" || len(username) > 24 {
		writeError(w, http.StatusUnprocessableEntity, "invalid_username", "Enter a valid username.")
		return
	}
	b, err := s.db.JSON(r.Context(), "", `
		select user_public_json(u) || jsonb_build_object('stats', (select row_to_json(ps) from profile_stats(u.id) ps))
		from users u
		where u.username = $1 and u.suspended_at is null`, username)
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}
