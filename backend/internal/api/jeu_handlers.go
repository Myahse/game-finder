package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
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

// Sports Mode Jeu plays (?sport=, basketball by default).
var jeuSports = map[string]bool{"basketball": true, "football": true, "volleyball": true, "tennis": true, "badminton": true}

func sportParam(r *http.Request) string {
	if s := r.URL.Query().Get("sport"); jeuSports[s] {
		return s
	}
	return "basketball"
}

// jeuResult records a solo Mode Jeu match for the avatar's XP (capped per week)
// and badges. Online results are recorded by the server itself.
func (s *Server) jeuResult(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Sport string         `json:"sport"`
		Won   bool           `json:"won"`
		MVP   bool           `json:"mvp"`
		Stats map[string]int `json:"stats"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || !jeuSports[body.Sport] {
		writeError(w, http.StatusUnprocessableEntity, "invalid", "A sport is required.")
		return
	}
	stats := map[string]int{}
	for _, k := range []string{"pts", "tpm", "goals", "aces", "smashes"} {
		if v, ok := body.Stats[k]; ok && v >= 0 && v < 100 {
			stats[k] = v
		}
	}
	b, err := s.db.JSON(r.Context(), uid(r), `select game_award(app_uid(), $1, 'solo', $2, $3, $4::jsonb, null)`, body.Sport, body.Won, body.MVP, stats)
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}

// jeuMe is the signed-in player's Mode Jeu avatar: attributes now and 30 days
// ago, XP and the real games behind them.
func (s *Server) jeuMe(w http.ResponseWriter, r *http.Request) {
	b, err := s.db.JSON(r.Context(), uid(r), `select game_me($1)`, sportParam(r))
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
	b, err := s.db.JSON(r.Context(), uid(r), `select game_players($1::uuid[], $2)`, ids, sportParam(r))
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
	b, err := s.db.JSON(r.Context(), uid(r), `select game_arena(c.id, $2) from courts c where c.id = $1`, id, sportParam(r))
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

// jeuCreateRoom opens an online match at a court between the host's team and
// the rivals, and tells the host's friends. The server plays the match; the
// players join it over /api/jeu/ws. Team A's first player is the host. Real
// players' attributes are loaded here, never taken from the client.
func (s *Server) jeuCreateRoom(w http.ResponseWriter, r *http.Request) {
	var body struct {
		CourtID string `json:"court_id"`
		Sport   string `json:"sport"`
		Size    int    `json:"size"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || !uuidRe.MatchString(body.CourtID) || !jeu.ValidSize(body.Sport, body.Size) {
		writeError(w, http.StatusUnprocessableEntity, "invalid", "A court, a sport and a team size are required.")
		return
	}
	me := strings.ToLower(uid(r))
	var exists bool
	if err := s.db.Pool.QueryRow(r.Context(), `select exists (select 1 from courts where id = $1)`, body.CourtID).Scan(&exists); err != nil {
		writeDBError(w, r, err)
		return
	}
	if !exists {
		writeError(w, http.StatusNotFound, "not_found", "Court not found.")
		return
	}
	room, err := s.jeu.CreateRoom(me, body.CourtID, body.Sport, body.Size)
	switch {
	case errors.Is(err, jeu.ErrTooManyRooms):
		writeError(w, http.StatusServiceUnavailable, "too_many_rooms", "Too many online matches right now. Try again in a moment.")
		return
	case err != nil:
		writeError(w, http.StatusUnprocessableEntity, "invalid", "This sport can't be played with that team size.")
		return
	}
	if err := s.db.Exec(r.Context(), uid(r), `select notify_game_room($1, $2)`, room.Code, body.CourtID); err != nil {
		slog.Error("notify game room", "code", room.Code, "err", err)
	}
	writeJSON(w, http.StatusCreated, room)
}

// jeuLoad gives the hub the players of an online match, with their attributes for the sport.
func jeuLoad(d *db.DB) jeu.LoadFunc {
	return func(ctx context.Context, sport string, ids []string) ([]jeu.RosterEntry, error) {
		if len(ids) == 0 {
			return nil, errors.New("no players")
		}
		raw, err := d.JSON(ctx, ids[0], `select game_players($1::uuid[], $2)`, ids, sport)
		if err != nil {
			return nil, err
		}
		var players []struct {
			User struct {
				ID        string `json:"id"`
				FirstName string `json:"first_name"`
				Username  string `json:"username"`
			} `json:"user"`
			Number     int       `json:"number"`
			Attributes jeu.Attrs `json:"attributes"`
		}
		if err := json.Unmarshal(raw, &players); err != nil {
			return nil, err
		}
		byID := map[string]jeu.RosterEntry{}
		for _, p := range players {
			name := strings.Fields(strings.TrimSpace(p.User.FirstName))
			n := p.User.Username
			if len(name) > 0 {
				n = name[0]
			}
			byID[strings.ToLower(p.User.ID)] = jeu.RosterEntry{ID: strings.ToLower(p.User.ID), Name: n, Num: p.Number, A: p.Attributes,
				Big: p.Attributes.Def+p.Attributes.Pen >= 150}
		}
		out := make([]jeu.RosterEntry, len(ids))
		for i, id := range ids {
			e, ok := byID[strings.ToLower(id)]
			if !ok {
				return nil, fmt.Errorf("unknown player %s", id)
			}
			out[i] = e
		}
		return out, nil
	}
}

// jeuAward records an online match for each player (XP within the weekly limit, badges).
func jeuAward(d *db.DB) jeu.AwardFunc {
	return func(ctx context.Context, ref, sport string, res []jeu.Result) (map[string]json.RawMessage, error) {
		out := map[string]json.RawMessage{}
		for _, p := range res {
			if !uuidRe.MatchString(p.ID) {
				continue
			}
			b, err := d.JSON(ctx, p.ID, `select game_award($1::uuid, $2, 'online', $3, $4, $5::jsonb, $6)`, p.ID, sport, p.Won, p.MVP, p.Stats, ref)
			if err != nil {
				slog.Error("jeu award", "user", p.ID, "err", err)
				continue
			}
			out[strings.ToLower(p.ID)] = b
		}
		return out, nil
	}
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
