package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
)

// getScoreboard returns a game's teams, score, player stats and MVP.
func (s *Server) getScoreboard(w http.ResponseWriter, r *http.Request) {
	b, err := s.db.JSON(r.Context(), uid(r), `select game_scoreboard_json($1)`, chi.URLParam(r, "id"))
	if err == nil && string(b) == "null" {
		writeError(w, http.StatusNotFound, "game_not_found", "Game not found.")
		return
	}
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}

// putScoreboard replaces a game's scoreboard (host, players in the game, admins).
func (s *Server) putScoreboard(w http.ResponseWriter, r *http.Request) {
	var in json.RawMessage
	if !readJSON(w, r, &in) {
		return
	}
	id := chi.URLParam(r, "id")
	if _, err := s.db.JSON(r.Context(), uid(r), `select save_game_scoreboard($1, $2::jsonb)`, id, string(in)); err != nil {
		writeDBError(w, r, err)
		return
	}
	s.afterScoreboard(r.Context(), id)
	b, err := s.db.JSON(r.Context(), uid(r), `select game_scoreboard_json($1)`, id)
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}

// courtLeaderboard ranks players at a court. ?period=month|all (default all).
func (s *Server) courtLeaderboard(w http.ResponseWriter, r *http.Request) {
	var since *time.Time
	switch r.URL.Query().Get("period") {
	case "", "all":
	case "month":
		t := time.Now().UTC().AddDate(0, 0, -30)
		since = &t
	default:
		writeError(w, http.StatusUnprocessableEntity, "invalid", "Invalid period.")
		return
	}
	b, err := s.db.JSON(r.Context(), uid(r), `select court_leaderboard($1, $2)`, chi.URLParam(r, "id"), since)
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}
