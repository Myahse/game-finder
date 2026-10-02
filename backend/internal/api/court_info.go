package api

import (
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
)

func (s *Server) patchCourtInfo(w http.ResponseWriter, r *http.Request) {
	courtID := chi.URLParam(r, "id")
	var in struct {
		OpensAt     string   `json:"opens_at"`
		ClosesAt    string   `json:"closes_at"`
		Address     string   `json:"address"`
		Surface     string   `json:"surface"`
		Description string   `json:"description"`
		Lighting    *bool    `json:"lighting"`
		SportIDs    []string `json:"sport_ids"`
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
	if len(in.SportIDs) == 0 {
		writeError(w, http.StatusUnprocessableEntity, "sport_required", "Choose at least one sport.")
		return
	}
	if !s.enforceCourtSportIDs(w, r, in.SportIDs) {
		return
	}

	var opening *string
	opens := strings.TrimSpace(in.OpensAt)
	closes := strings.TrimSpace(in.ClosesAt)
	switch {
	case opens == "" && closes == "":
		opening = nil
	case opens == "" || closes == "":
		writeError(w, http.StatusUnprocessableEntity, "invalid_hours", "Set both opening and closing times, or leave both empty.")
		return
	default:
		o, ok1 := normalizeHM(opens)
		c, ok2 := normalizeHM(closes)
		if !ok1 || !ok2 {
			writeError(w, http.StatusUnprocessableEntity, "invalid_hours", "Use 24-hour times like 06:00 and 22:00.")
			return
		}
		formatted := formatOpeningHours(o, c)
		opening = &formatted
	}

	addr := optionalTrimmed(in.Address, 200)
	surface := optionalTrimmed(in.Surface, 80)
	desc := optionalTrimmed(in.Description, 1000)

	err = s.db.Tx(r.Context(), uid(r), func(tx pgx.Tx) error {
		tag, err := tx.Exec(r.Context(), `
			update courts set
				opening_hours = $2, address = $3, surface = $4, description = $5, lighting = $6
			where id = $1 and (created_by = app_uid() or public.is_admin())`,
			courtID, opening, addr, surface, desc, in.Lighting)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return pgx.ErrNoRows
		}
		if _, err := tx.Exec(r.Context(), `
			delete from court_sports where court_id = $1 and sport_id <> all($2::uuid[])`, courtID, in.SportIDs); err != nil {
			return err
		}
		_, err = tx.Exec(r.Context(), `
			insert into court_sports (court_id, sport_id) select $1, unnest($2::uuid[])
			on conflict do nothing`, courtID, in.SportIDs)
		return err
	})
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	s.getCourt(w, r)
}

func optionalTrimmed(s string, max int) *string {
	t := strings.TrimSpace(s)
	if t == "" {
		return nil
	}
	if len(t) > max {
		t = t[:max]
	}
	return &t
}
