package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

type courtMoveInput struct {
	CourtID string  `json:"court_id"`
	Reason  *string `json:"reason"`
}

func readCourtMove(w http.ResponseWriter, r *http.Request) (courtMoveInput, bool) {
	var in courtMoveInput
	if !readJSON(w, r, &in) {
		return in, false
	}
	if in.CourtID == "" {
		writeError(w, http.StatusUnprocessableEntity, "court_required", "Choose a court.")
		return in, false
	}
	return in, true
}

// moveGame moves a scheduled/active game to another court (host or admin).
func (s *Server) moveGame(w http.ResponseWriter, r *http.Request) {
	in, ok := readCourtMove(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	if err := s.db.Exec(r.Context(), uid(r), `select move_game($1, $2, $3)`, id, in.CourtID, in.Reason); err != nil {
		writeDBError(w, r, err)
		return
	}
	s.writeGame(w, r, id, http.StatusOK)
}

// moveChallenge moves a challenge (and its game, once accepted) to another court.
func (s *Server) moveChallenge(w http.ResponseWriter, r *http.Request) {
	in, ok := readCourtMove(w, r)
	if !ok {
		return
	}
	b, err := s.db.JSON(r.Context(), uid(r), `select move_challenge($1, $2, $3)`, chi.URLParam(r, "id"), in.CourtID, in.Reason)
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}

// myCourtChanges lists moves of my upcoming games I haven't acknowledged yet.
func (s *Server) myCourtChanges(w http.ResponseWriter, r *http.Request) {
	b, err := s.db.JSON(r.Context(), uid(r), `select my_court_changes()`)
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}

func (s *Server) ackCourtChange(w http.ResponseWriter, r *http.Request) {
	if err := s.db.Exec(r.Context(), uid(r), `select ack_court_change($1)`, chi.URLParam(r, "id")); err != nil {
		writeDBError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
