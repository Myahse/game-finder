package api

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"regexp"
	"strings"

	"findthegame/backend/internal/db"
	"findthegame/backend/internal/jeu"

	"github.com/coder/websocket"
	"github.com/go-chi/chi/v5"
)

var uuidRe = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// friendIDs feeds the Mode Jeu hub: friends see each other on the game map.
func friendIDs(d *db.DB) jeu.FriendsFunc {
	return func(ctx context.Context, userID string) ([]string, error) {
		rows, err := d.Pool.Query(ctx, `
			select case when requester_id = $1 then addressee_id else requester_id end::text
			from friend_links where status = 'accepted' and (requester_id = $1 or addressee_id = $1)`, userID)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		var out []string
		for rows.Next() {
			var id string
			if err := rows.Scan(&id); err != nil {
				return nil, err
			}
			out = append(out, id)
		}
		return out, rows.Err()
	}
}

// jeuMe is the signed-in player's Mode Jeu avatar: attributes now and 30 days
// ago, XP and the real games behind them.
func (s *Server) jeuMe(w http.ResponseWriter, r *http.Request) {
	b, err := s.db.JSON(r.Context(), uid(r), `select game_me()`)
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}

// jeuPlayers returns attributes for up to 12 players (?ids=a,b,c).
func (s *Server) jeuPlayers(w http.ResponseWriter, r *http.Request) {
	ids := []string{}
	for _, id := range strings.Split(r.URL.Query().Get("ids"), ",") {
		if id = strings.TrimSpace(id); uuidRe.MatchString(id) && len(ids) < 12 {
			ids = append(ids, id)
		}
	}
	b, err := s.db.JSON(r.Context(), uid(r), `select game_players($1::uuid[])`, ids)
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}

// jeuArena is a court as an arena: its king, the team to beat and your friends.
func (s *Server) jeuArena(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if !uuidRe.MatchString(id) {
		writeError(w, http.StatusNotFound, "not_found", "Not found.")
		return
	}
	b, err := s.db.JSON(r.Context(), uid(r), `select game_arena(c.id) from courts c where c.id = $1`, id)
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}

// jeuRooms lists open online matches (?court_id= for one court).
func (s *Server) jeuRooms(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, s.jeu.Rooms(r.URL.Query().Get("court_id")))
}

// jeuCreateRoom opens an online match at a court, hosted by the caller, and
// tells their friends. The host then joins it over /api/jeu/ws.
func (s *Server) jeuCreateRoom(w http.ResponseWriter, r *http.Request) {
	var body struct {
		CourtID string `json:"court_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || !uuidRe.MatchString(body.CourtID) {
		writeError(w, http.StatusUnprocessableEntity, "invalid", "A court is required.")
		return
	}
	var exists bool
	if err := s.db.Pool.QueryRow(r.Context(), `select exists (select 1 from courts where id = $1)`, body.CourtID).Scan(&exists); err != nil {
		writeDBError(w, r, err)
		return
	}
	if !exists {
		writeError(w, http.StatusNotFound, "not_found", "Court not found.")
		return
	}
	room, err := s.jeu.CreateRoom(strings.ToLower(uid(r)), body.CourtID)
	if errors.Is(err, jeu.ErrTooManyRooms) {
		writeError(w, http.StatusServiceUnavailable, "too_many_rooms", "Too many online matches right now. Try again in a moment.")
		return
	}
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	if err := s.db.Exec(r.Context(), uid(r), `select notify_game_room($1, $2)`, room.Code, body.CourtID); err != nil {
		slog.Error("notify game room", "code", room.Code, "err", err)
	}
	writeJSON(w, http.StatusCreated, room)
}

// handleJeuWS is Mode Jeu's live connection (signed-in players only, ?ticket=).
func (s *Server) handleJeuWS(w http.ResponseWriter, r *http.Request) {
	if uid(r) == "" {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Sign in to play online.")
		return
	}
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{OriginPatterns: s.originPatterns(s.cfg.CORSOrigins)})
	if err != nil {
		return
	}
	s.jeu.Serve(r.Context(), conn, uid(r))
}
