package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

func (s *Server) createGameShareLink(w http.ResponseWriter, r *http.Request) {
	b, err := s.db.JSON(r.Context(), uid(r),
		`select jsonb_build_object('token', public.ensure_game_share_link($1::uuid))`,
		chi.URLParam(r, "id"))
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}

func (s *Server) getGameSharePreview(w http.ResponseWriter, r *http.Request) {
	b, err := s.db.JSON(r.Context(), "",
		`select coalesce(public.get_game_share_preview($1), 'null'::jsonb)`,
		chi.URLParam(r, "token"))
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	if len(b) == 0 || b[0] == 'n' {
		writeError(w, http.StatusNotFound, "game_link_not_found", "This game link is invalid or the game is no longer open.")
		return
	}
	writeRaw(w, http.StatusOK, b)
}
