package api

import (
	"net/http"
)

func (s *Server) assertBrowseLocation(w http.ResponseWriter, r *http.Request, lat, lng float64) bool {
	if uid(r) == "" {
		return true
	}
	if err := s.db.Exec(r.Context(), uid(r), "select public.assert_browse_location($1, $2)", lat, lng); err != nil {
		writeDBError(w, r, err)
		return false
	}
	return true
}
