package api

import (
	"context"
	"net/http"
)

type userSportProfile struct {
	PreferredSportID *string
	Role             string
}

func (p userSportProfile) isAdmin() bool { return p.Role == "admin" }

func (s *Server) userSportProfile(ctx context.Context, userID string) (userSportProfile, error) {
	var p userSportProfile
	err := s.db.Pool.QueryRow(ctx, `
		select preferred_sport_id::text, role from users where id = $1`, userID).Scan(&p.PreferredSportID, &p.Role)
	return p, err
}

// enforcePreferredSport returns false if a response was written.
func (s *Server) enforcePreferredSport(w http.ResponseWriter, r *http.Request, sportID string) bool {
	p, err := s.userSportProfile(r.Context(), uid(r))
	if err != nil {
		writeDBError(w, r, err)
		return false
	}
	if p.isAdmin() {
		return true
	}
	if p.PreferredSportID == nil || *p.PreferredSportID == "" {
		writeError(w, http.StatusUnprocessableEntity, "sport_required", "Choose your sport in setup first.")
		return false
	}
	if sportID != *p.PreferredSportID {
		writeError(w, http.StatusForbidden, "wrong_sport", "You can only use your chosen sport.")
		return false
	}
	return true
}

func (s *Server) enforceCourtSportIDs(w http.ResponseWriter, r *http.Request, sportIDs []string) bool {
	p, err := s.userSportProfile(r.Context(), uid(r))
	if err != nil {
		writeDBError(w, r, err)
		return false
	}
	if p.isAdmin() {
		return true
	}
	if p.PreferredSportID == nil || *p.PreferredSportID == "" {
		writeError(w, http.StatusUnprocessableEntity, "sport_required", "Choose your sport in setup first.")
		return false
	}
	if len(sportIDs) != 1 || sportIDs[0] != *p.PreferredSportID {
		writeError(w, http.StatusForbidden, "wrong_sport", "Tag courts with your sport only.")
		return false
	}
	return true
}
