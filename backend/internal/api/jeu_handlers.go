package api

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"findthegame/backend/internal/db"
	"findthegame/backend/internal/jeu"

	"github.com/coder/websocket"
	"github.com/go-chi/chi/v5"
)

var botRe = regexp.MustCompile(`^bot-[0-9]{1,2}$`)

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
		CourtID string   `json:"court_id"`
		A       []string `json:"a"`
		B       []string `json:"b"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || !uuidRe.MatchString(body.CourtID) || len(body.A) != 3 || len(body.B) != 3 {
		writeError(w, http.StatusUnprocessableEntity, "invalid", "A court and two teams of 3 are required.")
		return
	}
	me := strings.ToLower(uid(r))
	ids := append(append([]string{}, body.A...), body.B...)
	real := []string{}
	for i, id := range ids {
		id = strings.ToLower(strings.TrimSpace(id))
		ids[i] = id
		switch {
		case uuidRe.MatchString(id):
			real = append(real, id)
		case !botRe.MatchString(id):
			writeError(w, http.StatusUnprocessableEntity, "invalid", "Unknown player.")
			return
		}
	}
	if ids[0] != me {
		writeError(w, http.StatusUnprocessableEntity, "invalid", "You lead your team.")
		return
	}
	var info struct {
		Exists bool   `json:"exists"`
		Locale string `json:"locale"`
	}
	if err := s.db.Pool.QueryRow(r.Context(), `select exists (select 1 from courts where id = $1), coalesce((select locale from users where id = $2), 'en')`,
		body.CourtID, me).Scan(&info.Exists, &info.Locale); err != nil {
		writeDBError(w, r, err)
		return
	}
	if !info.Exists {
		writeError(w, http.StatusNotFound, "not_found", "Court not found.")
		return
	}
	raw, err := s.db.JSON(r.Context(), uid(r), `select game_players($1::uuid[], 'basketball')`, real)
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	var players []struct {
		User struct {
			ID        string `json:"id"`
			FirstName string `json:"first_name"`
			Username  string `json:"username"`
		} `json:"user"`
		Number     int       `json:"number"`
		Attributes jeu.Attrs `json:"attributes"`
		Sources    struct {
			Rpg float64 `json:"rpg"`
		} `json:"sources"`
	}
	if err := json.Unmarshal(raw, &players); err != nil {
		writeDBError(w, r, err)
		return
	}
	byID := map[string]jeu.RosterEntry{}
	for _, p := range players {
		name := strings.Fields(strings.TrimSpace(p.User.FirstName))
		n := p.User.Username
		if len(name) > 0 {
			n = name[0]
		}
		byID[strings.ToLower(p.User.ID)] = jeu.RosterEntry{ID: strings.ToLower(p.User.ID), Name: n, Num: p.Number, A: p.Attributes,
			Big: p.Sources.Rpg >= 5 || p.Attributes.Def+p.Attributes.Pen >= 150}
	}
	botName := "Player"
	if info.Locale == "fr" {
		botName = "Joueur"
	}
	teams := [2][]jeu.RosterEntry{}
	for i, id := range ids {
		e, ok := byID[id]
		if !ok && botRe.MatchString(id) {
			n, _ := strconv.Atoi(strings.TrimPrefix(id, "bot-"))
			e = jeu.BotRoster(n, botName, i/3*3)
			ok = true
		}
		if !ok {
			writeError(w, http.StatusUnprocessableEntity, "invalid", "Unknown player.")
			return
		}
		teams[i/3] = append(teams[i/3], e)
	}
	room, err := s.jeu.CreateRoom(me, body.CourtID, teams[0], teams[1])
	switch {
	case errors.Is(err, jeu.ErrTooManyRooms):
		writeError(w, http.StatusServiceUnavailable, "too_many_rooms", "Too many online matches right now. Try again in a moment.")
		return
	case errors.Is(err, jeu.ErrBadTeams):
		writeError(w, http.StatusUnprocessableEntity, "invalid", "Each player can only play once.")
		return
	case err != nil:
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
