package api

import (
	"context"
	"log/slog"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
)

func (s *Server) applyFriendInviteToken(ctx context.Context, userID, token string) {
	token = strings.TrimSpace(token)
	if token == "" || userID == "" {
		return
	}
	if err := s.db.Exec(ctx, userID, `select accept_friend_invite_for_user($1, $2)`, token, userID); err != nil {
		slog.Warn("friend invite apply failed", "user", userID, "err", err)
	}
}

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

func (s *Server) createFriendInviteLink(w http.ResponseWriter, r *http.Request) {
	b, err := s.db.JSON(r.Context(), uid(r), `select jsonb_build_object('token', ensure_friend_invite_link())`)
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}

func (s *Server) getFriendInvitePreview(w http.ResponseWriter, r *http.Request) {
	b, err := s.db.JSON(r.Context(), "", `select coalesce(get_friend_invite_preview($1), 'null'::jsonb)`, chi.URLParam(r, "token"))
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	if b == nil || len(b) == 0 || b[0] == 'n' {
		writeError(w, http.StatusNotFound, "invite_not_found", "This invite link is invalid or expired.")
		return
	}
	writeRaw(w, http.StatusOK, b)
}

func (s *Server) acceptFriendInviteLink(w http.ResponseWriter, r *http.Request) {
	if err := s.db.Exec(r.Context(), uid(r), `select accept_friend_invite_link($1)`, chi.URLParam(r, "token")); err != nil {
		writeDBError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// bumpConnect: both players tap "Connect" within a few seconds, close together → friends.
// Clients poll this while waiting; the response is {"status":"waiting"} or {"status":"matched","friend":{…}}.
func (s *Server) bumpConnect(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Latitude  *float64 `json:"latitude"`
		Longitude *float64 `json:"longitude"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	if in.Latitude == nil || in.Longitude == nil {
		writeError(w, http.StatusUnprocessableEntity, "location_required", "Turn on location to connect.")
		return
	}
	b, err := s.db.JSON(r.Context(), uid(r), `select bump_connect($1, $2)`, *in.Latitude, *in.Longitude)
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}

func (s *Server) bumpCancel(w http.ResponseWriter, r *http.Request) {
	if err := s.db.Exec(r.Context(), uid(r), `select bump_cancel()`); err != nil {
		writeDBError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
