package api

import (
	"net/http"
	"time"
)

// getMyRecap returns the signed-in player's stats for ?month=YYYY-MM (default: current month).
func (s *Server) getMyRecap(w http.ResponseWriter, r *http.Request) {
	month := time.Now().UTC()
	if q := r.URL.Query().Get("month"); q != "" {
		t, err := time.Parse("2006-01", q)
		if err != nil {
			writeError(w, http.StatusUnprocessableEntity, "invalid", "Use month=YYYY-MM.")
			return
		}
		month = t
	}
	b, err := s.db.JSON(r.Context(), uid(r), `select my_monthly_recap($1::date)`, month.Format("2006-01-02"))
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}
