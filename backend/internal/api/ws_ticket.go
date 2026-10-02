package api

import (
	"net/http"

	"github.com/jackc/pgx/v5"
)

func (s *Server) issueWsTicket(w http.ResponseWriter, r *http.Request) {
	var ticket string
	err := s.db.Tx(r.Context(), uid(r), func(tx pgx.Tx) error {
		return tx.QueryRow(r.Context(), "select public.issue_ws_ticket()").Scan(&ticket)
	})
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"ticket": ticket})
}
