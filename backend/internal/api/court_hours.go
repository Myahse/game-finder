package api

import (
	"context"
	"errors"
	"net/http"
	"regexp"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
)

var hmRe = regexp.MustCompile(`^([01]?\d|2[0-3]):([0-5]\d)$`)

func normalizeHM(s string) (string, bool) {
	s = strings.TrimSpace(s)
	if !hmRe.MatchString(s) {
		return "", false
	}
	parts := strings.Split(s, ":")
	if len(parts) != 2 {
		return "", false
	}
	h, m := parts[0], parts[1]
	if len(h) == 1 {
		h = "0" + h
	}
	if len(m) == 1 {
		m = "0" + m
	}
	return h + ":" + m, true
}

func formatOpeningHours(opens, closes string) string {
	return opens + "–" + closes
}

func parseOpeningHours(raw *string) (opens, closes string, ok bool) {
	if raw == nil || strings.TrimSpace(*raw) == "" {
		return "", "", false
	}
	for _, sep := range []string{"–", "-", "—", " to "} {
		if i := strings.Index(*raw, sep); i > 0 {
			o, ok1 := normalizeHM((*raw)[:i])
			c, ok2 := normalizeHM((*raw)[i+len(sep):])
			if ok1 && ok2 {
				return o, c, true
			}
		}
	}
	return "", "", false
}

func (s *Server) courtProposerMayEdit(ctx context.Context, courtID, userID string) (status int, code, msg string, err error) {
	var allowed bool
	if err := s.db.Pool.QueryRow(ctx, `
		select (c.created_by = $2 or exists (
			select 1 from users u where u.id = $2 and u.role = 'admin' and u.suspended_at is null
		))
		from courts c where c.id = $1`, courtID, userID).Scan(&allowed); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return http.StatusNotFound, "not_found", "Court not found.", nil
		}
		return 0, "", "", err
	}
	if !allowed {
		return http.StatusForbidden, "not_allowed", "You can only edit courts you proposed.", nil
	}
	return 0, "", "", nil
}

func (s *Server) patchCourtHours(w http.ResponseWriter, r *http.Request) {
	courtID := chi.URLParam(r, "id")
	var in struct {
		OpensAt  *string `json:"opens_at"`
		ClosesAt *string `json:"closes_at"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	status, code, msg, err := s.courtProposerMayEdit(r.Context(), courtID, uid(r))
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	if status != 0 {
		writeError(w, status, code, msg)
		return
	}

	var opening *string
	switch {
	case in.OpensAt == nil && in.ClosesAt == nil:
		opening = nil
	case in.OpensAt == nil || in.ClosesAt == nil:
		writeError(w, http.StatusUnprocessableEntity, "invalid_hours", "Set both opening and closing times, or clear both.")
		return
	default:
		opens, ok1 := normalizeHM(*in.OpensAt)
		closes, ok2 := normalizeHM(*in.ClosesAt)
		if !ok1 || !ok2 {
			writeError(w, http.StatusUnprocessableEntity, "invalid_hours", "Use 24-hour times like 06:00 and 22:00.")
			return
		}
		formatted := formatOpeningHours(opens, closes)
		opening = &formatted
	}

	err = s.db.Exec(r.Context(), uid(r), `
		update courts set opening_hours = $2 where id = $1`, courtID, opening)
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"opening_hours": opening})
}
