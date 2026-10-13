package api

import (
	"net/http"
	"regexp"

	"github.com/go-chi/chi/v5"
)

var questRe = regexp.MustCompile(`^[a-z_]{2,16}$`)

// The phone says whether Mode Jeu is on (it adds Mode Jeu quests to the day).
func questJeu(r *http.Request) bool { return r.URL.Query().Get("jeu") == "1" }

// getMyQuests returns today's 3 quests, what's done and claimed, and the streak.
func (s *Server) getMyQuests(w http.ResponseWriter, r *http.Request) {
	b, err := s.db.JSON(r.Context(), uid(r), `select daily_quests(app_uid(), $1)`, questJeu(r))
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}

// claimQuest gives the XP of a done quest ("all" once the three are done).
func (s *Server) claimQuest(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if !questRe.MatchString(id) {
		writeError(w, http.StatusUnprocessableEntity, "quest_not_done", "This quest isn't done yet.")
		return
	}
	b, err := s.db.JSON(r.Context(), uid(r), `select claim_quest(app_uid(), $1, $2)`, id, questJeu(r))
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}
