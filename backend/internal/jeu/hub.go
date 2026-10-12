// Package jeu runs Mode Jeu's live side: who is walking on the game map (a
// position on the real map, seen by friends only) and online matches. A match is played on its host's phone,
// which sends the match state; the server relays it to the room and forwards
// the others' choices to the host, stamped with their user id so nobody can
// speak for someone else. Rooms live in memory: a restart ends open matches.
package jeu

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"math/big"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/coder/websocket"
)

const (
	maxMessage   = 8 << 10
	maxRoomUsers = 12
	maxRooms     = 500
	roomTTL      = 2 * time.Hour
	hostGrace    = 60 * time.Second
	codeChars    = "abcdefghjkmnpqrstuvwxyz23456789"
)

// Reactions anyone in a match can send.
var reactions = map[string]bool{"fire": true, "clap": true, "wow": true, "strong": true}

var (
	ErrTooManyRooms = errors.New("too_many_rooms")
	ErrNoRoom       = errors.New("not_found")
)

// FriendsFunc lists a user's accepted friends (for who sees whom on the map).
type FriendsFunc func(ctx context.Context, userID string) ([]string, error)

type Room struct {
	Code      string    `json:"code"`
	CourtID   string    `json:"court_id"`
	HostID    string    `json:"host_id"`
	CreatedAt time.Time `json:"created_at"`
	Players   int       `json:"players"`
	Started   bool      `json:"started"`

	finished  bool
	state     json.RawMessage
	members   map[*conn]struct{}
	hostConn  *conn
	hostLeft  time.Time
	lastState time.Time
}

type conn struct {
	userID  string
	send    chan []byte
	room    *Room
	friends map[string]bool
	pos     *position
	present bool // said hello in Mode Jeu (seen by friends even before walking)
	tokens  float64
	last    time.Time
}

type position struct {
	UserID string  `json:"user_id"`
	Lat    float64 `json:"lat"`
	Lng    float64 `json:"lng"`
	Scene  string  `json:"scene"`
	Room   string  `json:"room,omitempty"`
	// OnMap is false for a friend in Mode Jeu who hasn't walked on the map yet.
	OnMap bool `json:"on_map"`
}

type Hub struct {
	mu      sync.Mutex
	rooms   map[string]*Room
	conns   map[*conn]struct{}
	friends FriendsFunc
	now     func() time.Time
}

func NewHub(friends FriendsFunc) *Hub {
	return &Hub{rooms: map[string]*Room{}, conns: map[*conn]struct{}{}, friends: friends, now: time.Now}
}

// CreateRoom opens a match hosted by hostID at a court and returns its code.
func (h *Hub) CreateRoom(hostID, courtID string) (*Room, error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.sweepLocked()
	if len(h.rooms) >= maxRooms {
		return nil, ErrTooManyRooms
	}
	// One open match per host: a new one replaces the old.
	for code, r := range h.rooms {
		if r.HostID == hostID {
			h.closeRoomLocked(code, "replaced")
		}
	}
	var code string
	for {
		code = randomCode()
		if _, taken := h.rooms[code]; !taken {
			break
		}
	}
	r := &Room{Code: code, CourtID: courtID, HostID: hostID, CreatedAt: h.now(), members: map[*conn]struct{}{}}
	h.rooms[code] = r
	return r.public(), nil
}

// Rooms lists open, unfinished matches, optionally at one court.
func (h *Hub) Rooms(courtID string) []Room {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.sweepLocked()
	out := []Room{}
	for _, r := range h.rooms {
		if r.finished || (courtID != "" && r.CourtID != courtID) {
			continue
		}
		out = append(out, *r.public())
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out
}

func (r *Room) public() *Room {
	return &Room{Code: r.Code, CourtID: r.CourtID, HostID: r.HostID, CreatedAt: r.CreatedAt, Players: len(r.members), Started: r.state != nil}
}

func (h *Hub) sweepLocked() {
	now := h.now()
	for code, r := range h.rooms {
		if now.Sub(r.CreatedAt) > roomTTL || (r.hostConn == nil && !r.hostLeft.IsZero() && now.Sub(r.hostLeft) > hostGrace) ||
			(r.hostConn == nil && r.hostLeft.IsZero() && now.Sub(r.CreatedAt) > hostGrace) {
			h.closeRoomLocked(code, "closed")
		}
	}
}

func (h *Hub) closeRoomLocked(code, why string) {
	r := h.rooms[code]
	if r == nil {
		return
	}
	for c := range r.members {
		c.room = nil
		h.sendLocked(c, map[string]any{"t": "closed", "code": code, "why": why})
	}
	delete(h.rooms, code)
}

// Serve pumps one signed-in player's Mode Jeu connection until it closes.
func (h *Hub) Serve(ctx context.Context, ws *websocket.Conn, userID string) {
	ws.SetReadLimit(maxMessage)
	c := &conn{userID: strings.ToLower(userID), send: make(chan []byte, 64), friends: map[string]bool{}, present: true, tokens: 40, last: h.now()}
	if h.friends != nil {
		if ids, err := h.friends(ctx, c.userID); err == nil {
			for _, id := range ids {
				c.friends[strings.ToLower(id)] = true
			}
		}
	}
	h.mu.Lock()
	h.conns[c] = struct{}{}
	h.mu.Unlock()
	defer h.drop(c)

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	go func() {
		defer cancel()
		for {
			_, data, err := ws.Read(ctx)
			if err != nil {
				return
			}
			h.handle(c, data)
		}
	}()

	ping := time.NewTicker(25 * time.Second)
	defer ping.Stop()
	lobby := time.NewTicker(500 * time.Millisecond)
	defer lobby.Stop()
	_ = ws.Write(ctx, websocket.MessageText, []byte(`{"t":"hello"}`))
	var lastLobby []byte
	for {
		select {
		case <-ctx.Done():
			ws.Close(websocket.StatusNormalClosure, "")
			return
		case msg := <-c.send:
			wctx, wc := context.WithTimeout(ctx, 10*time.Second)
			err := ws.Write(wctx, websocket.MessageText, msg)
			wc()
			if err != nil {
				return
			}
		case <-lobby.C:
			if b := h.lobbyFor(c); string(b) != string(lastLobby) {
				lastLobby = b
				wctx, wc := context.WithTimeout(ctx, 10*time.Second)
				err := ws.Write(wctx, websocket.MessageText, b)
				wc()
				if err != nil {
					return
				}
			}
		case <-ping.C:
			pctx, pc := context.WithTimeout(ctx, 10*time.Second)
			err := ws.Ping(pctx)
			pc()
			if err != nil {
				return
			}
		}
	}
}

// lobbyFor is what one player sees: friends on the map and open matches.
func (h *Hub) lobbyFor(c *conn) []byte {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.sweepLocked()
	players := []position{}
	seen := map[string]bool{}
	for o := range h.conns {
		if o == c || o.userID == c.userID || !c.friends[o.userID] || seen[o.userID] || (o.pos == nil && o.room == nil && !o.present) {
			continue
		}
		seen[o.userID] = true
		p := position{UserID: o.userID, Scene: "arena"}
		if o.pos != nil {
			p = *o.pos
			p.OnMap = true
		}
		if o.room != nil {
			p.Room = o.room.Code
		}
		players = append(players, p)
	}
	sort.Slice(players, func(i, j int) bool { return players[i].UserID < players[j].UserID })
	rooms := []*Room{}
	for _, r := range h.rooms {
		if !r.finished && r.hostConn != nil {
			rooms = append(rooms, r.public())
		}
	}
	sort.Slice(rooms, func(i, j int) bool { return rooms[i].Code < rooms[j].Code })
	b, _ := json.Marshal(map[string]any{"t": "lobby", "players": players, "rooms": rooms})
	return b
}

type inMsg struct {
	T     string          `json:"t"`
	Code  string          `json:"code"`
	Lat   float64         `json:"lat"`
	Lng   float64         `json:"lng"`
	Scene string          `json:"scene"`
	S     json.RawMessage `json:"s"`
	K     *string         `json:"k"`
	Q     int             `json:"q"`
	I     int             `json:"i"`
	E     string          `json:"e"`
}

func (h *Hub) handle(c *conn, data []byte) {
	h.mu.Lock()
	defer h.mu.Unlock()
	// Token bucket: about 40 messages a second, bursts of 40.
	now := h.now()
	c.tokens = minf(40, c.tokens+now.Sub(c.last).Seconds()*40)
	c.last = now
	if c.tokens < 1 {
		return
	}
	c.tokens--

	var m inMsg
	if json.Unmarshal(data, &m) != nil {
		return
	}
	switch m.T {
	case "pos":
		scene := m.Scene
		if scene != "map" && scene != "arena" && scene != "match" && scene != "summary" && scene != "avatar" {
			scene = "map"
		}
		c.pos = &position{UserID: c.userID, Lat: clampf(m.Lat, -90, 90), Lng: clampf(m.Lng, -180, 180), Scene: scene}
		c.present = true
	case "hide":
		c.pos = nil
		c.present = false
	case "join":
		h.joinLocked(c, strings.ToLower(strings.TrimSpace(m.Code)))
	case "leave":
		h.leaveLocked(c)
	case "state":
		r := c.room
		if r == nil || r.hostConn != c || len(m.S) == 0 || len(m.S) > 6<<10 {
			return
		}
		r.state = append(r.state[:0], m.S...)
		r.lastState = now
		var fin struct {
			Fin int `json:"fin"`
		}
		if json.Unmarshal(m.S, &fin) == nil && fin.Fin == 1 {
			r.finished = true
		}
		h.roomcastLocked(r, c, map[string]any{"t": "state", "s": m.S})
	case "claim":
		r := c.room
		if r == nil || r.hostConn == nil || r.hostConn == c {
			return
		}
		var k any
		if m.K != nil && len(*m.K) <= 40 {
			k = *m.K
		}
		h.sendLocked(r.hostConn, map[string]any{"t": "claim", "from": c.userID, "k": k})
	case "intent":
		r := c.room
		if r == nil || r.hostConn == nil || r.hostConn == c || m.I < 0 || m.I > 8 {
			return
		}
		h.sendLocked(r.hostConn, map[string]any{"t": "intent", "from": c.userID, "q": m.Q, "i": m.I})
	case "react":
		r := c.room
		if r == nil || !reactions[m.E] {
			return
		}
		h.roomcastLocked(r, c, map[string]any{"t": "react", "from": c.userID, "e": m.E})
	}
}

func (h *Hub) joinLocked(c *conn, code string) {
	h.sweepLocked()
	r := h.rooms[code]
	if r == nil {
		h.sendLocked(c, map[string]any{"t": "error", "code": "not_found"})
		return
	}
	if c.room == r {
		return
	}
	if len(r.members) >= maxRoomUsers {
		h.sendLocked(c, map[string]any{"t": "error", "code": "room_full"})
		return
	}
	h.leaveLocked(c)
	c.room = r
	r.members[c] = struct{}{}
	isHost := c.userID == r.HostID
	if isHost {
		r.hostConn = c
		r.hostLeft = time.Time{}
	}
	h.sendLocked(c, map[string]any{"t": "joined", "code": r.Code, "court_id": r.CourtID, "host_id": r.HostID, "host": isHost, "state": r.state})
	h.membersLocked(r)
}

func (h *Hub) leaveLocked(c *conn) {
	r := c.room
	if r == nil {
		return
	}
	delete(r.members, c)
	c.room = nil
	if r.hostConn == c {
		r.hostConn = nil
		r.hostLeft = h.now()
		h.roomcastLocked(r, nil, map[string]any{"t": "host_left"})
	}
	h.membersLocked(r)
}

func (h *Hub) membersLocked(r *Room) {
	ids := []string{}
	seen := map[string]bool{}
	for m := range r.members {
		if !seen[m.userID] {
			seen[m.userID] = true
			ids = append(ids, m.userID)
		}
	}
	sort.Strings(ids)
	h.roomcastLocked(r, nil, map[string]any{"t": "members", "code": r.Code, "members": ids, "host_online": r.hostConn != nil})
}

func (h *Hub) drop(c *conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.leaveLocked(c)
	delete(h.conns, c)
}

func (h *Hub) roomcastLocked(r *Room, except *conn, v any) {
	b, _ := json.Marshal(v)
	for m := range r.members {
		if m != except {
			h.pushLocked(m, b)
		}
	}
}

func (h *Hub) sendLocked(c *conn, v any) {
	b, _ := json.Marshal(v)
	h.pushLocked(c, b)
}

func (h *Hub) pushLocked(c *conn, b []byte) {
	select {
	case c.send <- b:
	default: // slow client: drop rather than block the room
	}
}

func randomCode() string {
	var sb strings.Builder
	for i := 0; i < 4; i++ {
		n, _ := rand.Int(rand.Reader, big.NewInt(int64(len(codeChars))))
		sb.WriteByte(codeChars[n.Int64()])
	}
	return sb.String()
}

func clampf(v, lo, hi float64) float64 {
	if v != v || v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

func minf(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}
