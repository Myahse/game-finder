package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

func (s *Server) listFriends(w http.ResponseWriter, r *http.Request) {
	b, err := s.db.JSON(r.Context(), uid(r), `select list_my_friends()`)
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}

func (s *Server) listFriendRequests(w http.ResponseWriter, r *http.Request) {
	b, err := s.db.JSON(r.Context(), uid(r), `select list_friend_requests()`)
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}

func (s *Server) sendFriendRequest(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Username string `json:"username"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	b, err := s.db.JSON(r.Context(), uid(r), `select send_friend_request($1)`, in.Username)
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}

func (s *Server) acceptFriendRequest(w http.ResponseWriter, r *http.Request) {
	if err := s.db.Exec(r.Context(), uid(r), `select respond_friend_request($1, true)`, chi.URLParam(r, "id")); err != nil {
		writeDBError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) rejectFriendRequest(w http.ResponseWriter, r *http.Request) {
	if err := s.db.Exec(r.Context(), uid(r), `select respond_friend_request($1, false)`, chi.URLParam(r, "id")); err != nil {
		writeDBError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
