// Package jeu runs Mode Jeu's live side: who is walking on the game map (a
// position on the real map, seen by friends only) and online matches. The
// server plays each online match itself (engine.go) and sends its state to
// everyone in the room about 20 times a second, so no phone has to stay awake:
// the creator can lock their screen, switch apps or leave, and the match goes
// on. Players send only their choices, stamped with their user id here so
// nobody can speak for someone else. Rooms live in memory: a restart ends
// open matches.
package jeu

import (
	"context"
	"crypto/rand"
	"encoding/binary"
	"encoding/json"
	"errors"
	"math/big"
	"sort"
	"strconv"
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
	emptyTTL     = 3 * time.Minute  // a match nobody watches stops after this
	finishedTTL  = 10 * time.Minute // the final score stays this long for late viewers
	tickEvery    = 50 * time.Millisecond
	codeChars    = "abcdefghjkmnpqrstuvwxyz23456789"
)

// Reactions anyone in a match can send.
var reactions = map[string]bool{"fire": true, "clap": true, "wow": true, "strong": true}

var (
	ErrTooManyRooms = errors.New("too_many_rooms")
	ErrBadTeams     = errors.New("invalid_teams")
)

// FriendsFunc lists a user's accepted friends (for who sees whom on the map).
type FriendsFunc func(ctx context.Context, userID string) ([]string, error)

// Room is an online match as listed to players.
type Room struct {
	Code      string    `json:"code"`
	CourtID   string    `json:"court_id"`
	HostID    string    `json:"host_id"`
	CreatedAt time.Time `json:"created_at"`
	Players   int       `json:"players"`
	Started   bool      `json:"started"`

	match      *Match
	claims     map[string]string // player index → user id
	speed      float64
	pauseUntil time.Time
	finishedAt time.Time
	emptySince time.Time
	members    map[*conn]struct{}
}

type conn struct {
	userID  string
	send    chan []byte
	room    *Room
	friends map[string]bool
	pos     *position
	present bool // in Mode Jeu (seen by friends even before walking)
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

// NewHub starts the hub; its matches tick until ctx ends.
func NewHub(ctx context.Context, friends FriendsFunc) *Hub {
	h := &Hub{rooms: map[string]*Room{}, conns: map[*conn]struct{}{}, friends: friends, now: time.Now}
	go h.run(ctx)
	return h
}

// CreateRoom opens a match hosted by hostID at a court between two teams of 3
// (team A's first player is the host) and starts it right away.
func (h *Hub) CreateRoom(hostID, courtID string, a, b []RosterEntry) (*Room, error) {
	if len(a) != 3 || len(b) != 3 || !strings.EqualFold(a[0].ID, hostID) {
		return nil, ErrBadTeams
	}
	seen := map[string]bool{}
	for _, r := range append(append([]RosterEntry{}, a...), b...) {
		if r.ID == "" || seen[strings.ToLower(r.ID)] {
			return nil, ErrBadTeams
		}
		seen[strings.ToLower(r.ID)] = true
	}
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
	var seed [8]byte
	_, _ = rand.Read(seed[:])
	now := h.now()
	r := &Room{Code: code, CourtID: courtID, HostID: hostID, CreatedAt: now, members: map[*conn]struct{}{}, claims: map[string]string{}, speed: 1, emptySince: now}
	r.match = NewMatch(a, b, binary.LittleEndian.Uint64(seed[:]))
	r.match.HumanFor = func(i int) string { return r.claims[strconv.Itoa(i)] }
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
		if r.match.Finished() || (courtID != "" && r.CourtID != courtID) {
			continue
		}
		out = append(out, *r.public())
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out
}

func (r *Room) public() *Room {
	return &Room{Code: r.Code, CourtID: r.CourtID, HostID: r.HostID, CreatedAt: r.CreatedAt, Players: len(r.members), Started: true}
}

// run advances every match and sends each room its state.
func (h *Hub) run(ctx context.Context) {
	t := time.NewTicker(tickEvery)
	defer t.Stop()
	last := h.now()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
		h.mu.Lock()
		now := h.now()
		real := now.Sub(last).Seconds()
		last = now
		if real > 0.25 {
			real = 0.25 // after a stall, don't jump ahead
		}
		h.sweepLocked()
		for _, r := range h.rooms {
			h.tickLocked(r, now, real)
		}
		h.mu.Unlock()
	}
}

func (h *Hub) tickLocked(r *Room, now time.Time, real float64) {
	m := r.match
	if !r.finishedAt.IsZero() && now.Sub(r.finishedAt) > 8*time.Second {
		return // the celebration is over; the final state is sent on join
	}
	if now.After(r.pauseUntil) {
		m.Tick(real*r.speed*m.Slow(), real)
	}
	if m.Finished() && r.finishedAt.IsZero() {
		r.finishedAt = now
	}
	if len(r.members) > 0 {
		h.roomcastLocked(r, nil, map[string]any{"t": "state", "s": h.snapLocked(r)})
	}
}

func (h *Hub) snapLocked(r *Room) map[string]any {
	s := r.match.Snapshot(r.claims, 0)
	s["sp"] = r.speed
	s["pause"] = h.now().Before(r.pauseUntil)
	return s
}

func (h *Hub) sweepLocked() {
	now := h.now()
	for code, r := range h.rooms {
		if now.Sub(r.CreatedAt) > roomTTL ||
			(len(r.members) == 0 && now.Sub(r.emptySince) > emptyTTL) ||
			(!r.finishedAt.IsZero() && now.Sub(r.finishedAt) > finishedTTL) {
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
	write := func(b []byte) bool {
		wctx, wc := context.WithTimeout(ctx, 10*time.Second)
		defer wc()
		return ws.Write(wctx, websocket.MessageText, b) == nil
	}
	for {
		select {
		case <-ctx.Done():
			ws.Close(websocket.StatusNormalClosure, "")
			return
		case msg := <-c.send:
			if !write(msg) {
				return
			}
		case <-lobby.C:
			if b := h.lobbyFor(c); string(b) != string(lastLobby) {
				lastLobby = b
				if !write(b) {
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

// lobbyFor is what one player sees: friends in Mode Jeu and open matches.
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
		if !r.match.Finished() {
			rooms = append(rooms, r.public())
		}
	}
	sort.Slice(rooms, func(i, j int) bool { return rooms[i].Code < rooms[j].Code })
	b, _ := json.Marshal(map[string]any{"t": "lobby", "players": players, "rooms": rooms})
	return b
}

type inMsg struct {
	T     string  `json:"t"`
	Code  string  `json:"code"`
	Lat   float64 `json:"lat"`
	Lng   float64 `json:"lng"`
	Scene string  `json:"scene"`
	K     *string `json:"k"`
	V     string  `json:"v"`
	N     float64 `json:"n"`
	Q     int     `json:"q"`
	I     int     `json:"i"`
	E     string  `json:"e"`
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
	r := c.room
	host := r != nil && c.userID == r.HostID
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
	case "claim":
		// Player 0 is the host's own avatar; the others are free for anyone in the room.
		if r == nil {
			return
		}
		want := ""
		if m.K != nil {
			want = *m.K
		}
		if want != "" {
			if n, err := strconv.Atoi(want); err != nil || n < 0 || n > 5 || (n == 0) != host {
				return
			}
			if owner, taken := r.claims[want]; taken && owner != c.userID {
				return
			}
		}
		for k, u := range r.claims {
			if u == c.userID && k != want {
				delete(r.claims, k)
			}
		}
		if want != "" {
			r.claims[want] = c.userID
		}
		h.checkAwaitLocked(r)
	case "intent":
		if r != nil {
			r.match.Choose(m.Q, m.I, c.userID)
		}
	case "tactic":
		if host && m.K != nil {
			r.match.SetTactic(*m.K, m.V)
		}
	case "timeout":
		if host && r.match.Timeout() {
			r.pauseUntil = now.Add(1600 * time.Millisecond)
		}
	case "speed":
		if host && (m.N == 1 || m.N == 2 || m.N == 4) {
			r.speed = m.N
		}
	case "react":
		if r != nil && reactions[m.E] {
			h.roomcastLocked(r, c, map[string]any{"t": "react", "from": c.userID, "e": m.E})
		}
	}
}

// checkAwaitLocked lets the AI play a turn whose player nobody controls anymore.
func (h *Hub) checkAwaitLocked(r *Room) {
	if aw := r.match.aw; aw != nil && r.claims[strconv.Itoa(aw.k)] != aw.who {
		r.match.AITakesOver()
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
	h.sendLocked(c, map[string]any{"t": "joined", "code": r.Code, "court_id": r.CourtID, "host_id": r.HostID, "host": c.userID == r.HostID, "state": h.snapLocked(r)})
	h.membersLocked(r)
}

func (h *Hub) leaveLocked(c *conn) {
	r := c.room
	if r == nil {
		return
	}
	delete(r.members, c)
	c.room = nil
	// A player who left (all their tabs) gives their player back to the AI.
	still := false
	for o := range r.members {
		still = still || o.userID == c.userID
	}
	if !still {
		for k, u := range r.claims {
			if u == c.userID {
				delete(r.claims, k)
			}
		}
		h.checkAwaitLocked(r)
	}
	if len(r.members) == 0 {
		r.emptySince = h.now()
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
	h.roomcastLocked(r, nil, map[string]any{"t": "members", "code": r.Code, "members": ids, "host_online": seen[r.HostID]})
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
