package api

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
)

// createChallenge sends a challenge to a player (opponent_id) or, without one,
// opens it to anyone at the court. start_time omitted = live (now).
func (s *Server) createChallenge(w http.ResponseWriter, r *http.Request) {
	var in struct {
		OpponentID *string    `json:"opponent_id"`
		SportID    string     `json:"sport_id"`
		Format     string     `json:"format"`
		CourtID    string     `json:"court_id"`
		StartTime  *time.Time `json:"start_time"`
		Message    string     `json:"message"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	if in.SportID == "" || in.Format == "" || in.CourtID == "" {
		writeError(w, http.StatusUnprocessableEntity, "invalid_input", "Choose a sport, format and court.")
		return
	}
	if in.OpponentID != nil && *in.OpponentID == "" {
		in.OpponentID = nil
	}
	b, err := s.db.JSON(r.Context(), uid(r), `select create_challenge($1, $2, $3, $4, $5, $6)`,
		in.OpponentID, in.SportID, in.Format, in.CourtID, in.StartTime, in.Message)
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusCreated, b)
}

func (s *Server) listChallenges(w http.ResponseWriter, r *http.Request) {
	b, err := s.db.JSON(r.Context(), uid(r), `select my_challenges()`)
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}

func (s *Server) getChallenge(w http.ResponseWriter, r *http.Request) {
	b, err := s.db.JSON(r.Context(), uid(r), `
		select challenge_json(c) from challenges c
		where c.id = $1 and (c.opponent_id is null or app_uid() in (c.challenger_id, c.opponent_id) or is_admin()
		  or exists (select 1 from challenge_players cp where cp.challenge_id = c.id and cp.user_id = app_uid()))`,
		chi.URLParam(r, "id"))
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}

func (s *Server) challengeAction(sql string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		b, err := s.db.JSON(r.Context(), uid(r), sql, chi.URLParam(r, "id"))
		if err != nil {
			writeDBError(w, r, err)
			return
		}
		writeRaw(w, http.StatusOK, b)
	}
}

func (s *Server) reportChallenge(w http.ResponseWriter, r *http.Request) {
	var in struct {
		WinnerID        string `json:"winner_id"`
		ScoreChallenger string `json:"score_challenger"`
		ScoreOpponent   string `json:"score_opponent"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	if in.WinnerID == "" {
		writeError(w, http.StatusUnprocessableEntity, "invalid_input", "Pick the winner.")
		return
	}
	b, err := s.db.JSON(r.Context(), uid(r), `select report_challenge($1, $2, $3, $4)`,
		chi.URLParam(r, "id"), in.WinnerID, in.ScoreChallenger, in.ScoreOpponent)
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}

func (s *Server) openChallengesAtCourt(w http.ResponseWriter, r *http.Request) {
	b, err := s.db.JSON(r.Context(), uid(r), `select open_challenges_at($1)`, chi.URLParam(r, "id"))
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}

func (s *Server) headToHead(w http.ResponseWriter, r *http.Request) {
	b, err := s.db.JSON(r.Context(), uid(r), `select head_to_head($1)`, chi.URLParam(r, "id"))
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}

// addChallengePlayer invites @username to a side ("challenger" = my team, "opponent").
func (s *Server) addChallengePlayer(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Username string `json:"username"`
		Side     string `json:"side"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	if in.Username == "" {
		writeError(w, http.StatusUnprocessableEntity, "invalid_input", "Enter a username.")
		return
	}
	if in.Side == "" {
		in.Side = "opponent"
	}
	b, err := s.db.JSON(r.Context(), uid(r), `select add_challenge_player($1, $2, $3)`, chi.URLParam(r, "id"), in.Username, in.Side)
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}

// updateChallengeMessage lets the challenger rewrite the message ("" clears it).
func (s *Server) updateChallengeMessage(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Message string `json:"message"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	b, err := s.db.JSON(r.Context(), uid(r), `select update_challenge_message($1, $2)`, chi.URLParam(r, "id"), in.Message)
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}
