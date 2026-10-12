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
	"math"
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

const countdown = 3 * time.Second

var (
	ErrTooManyRooms = errors.New("too_many_rooms")
	ErrBadTeams     = errors.New("invalid_teams")
)

// FriendsFunc lists a user's accepted friends (for who sees whom on the map).
type FriendsFunc func(ctx context.Context, userID string) ([]string, error)

// LoadFunc returns the match players for user ids, in that order, with their
// attributes for the sport (computed from their real games).
type LoadFunc func(ctx context.Context, sport string, ids []string) ([]RosterEntry, error)

// AwardFunc records an online match's results (XP and badges) and returns,
// for each user, what to tell them (a JSON object).
type AwardFunc func(ctx context.Context, ref, sport string, res []Result) (map[string]json.RawMessage, error)

// Deps are what the hub needs from the rest of the server.
type Deps struct {
	Friends FriendsFunc
	Load    LoadFunc
	Award   AwardFunc
}

// Room is an online match as listed to players. Every spot is a real player:
// the match starts once all spots are taken by players who are online and
// ready, then the server plays it.
type Room struct {
	Code      string    `json:"code"`
	CourtID   string    `json:"court_id"`
	HostID    string    `json:"host_id"`
	Sport     string    `json:"sport"`
	Size      int       `json:"size"`
	CreatedAt time.Time `json:"created_at"`
	Players   int       `json:"players"`
	Filled    int       `json:"filled"`
	Started   bool      `json:"started"`

	slots      []string // spot → user id ("" free); spot i is the match's player i
	ready      map[string]bool
	startAt    time.Time
	loading    bool
	match      Sim
	awarded    bool
	finishedAt time.Time
	emptySince time.Time
	lastRoom   string
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
	mu    sync.Mutex
	rooms map[string]*Room
	conns map[*conn]struct{}
	deps  Deps
	now   func() time.Time
	ctx   context.Context
}

// NewHub starts the hub; its matches tick until ctx ends.
func NewHub(ctx context.Context, deps Deps) *Hub {
	h := &Hub{rooms: map[string]*Room{}, conns: map[*conn]struct{}{}, deps: deps, now: time.Now, ctx: ctx}
	go h.run(ctx)
	return h
}

// ValidSize reports whether Mode Jeu plays this sport online with teams of n.
func ValidSize(sport string, n int) bool {
	for _, x := range Sizes[sport] {
		if x == n {
			return true
		}
	}
	return false
}

// CreateRoom opens an online match of a sport at a court, {size} against
// {size}; the host takes the first spot.
func (h *Hub) CreateRoom(hostID, courtID, sport string, size int) (*Room, error) {
	if !ValidSize(sport, size) || hostID == "" {
		return nil, ErrBadTeams
	}
	hostID = strings.ToLower(hostID)
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
	now := h.now()
	r := &Room{Code: code, CourtID: courtID, HostID: hostID, Sport: sport, Size: size, CreatedAt: now, members: map[*conn]struct{}{},
		slots: make([]string, size*2), ready: map[string]bool{}, emptySince: now}
	r.slots[0] = hostID
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
		if r.finished() || (courtID != "" && r.CourtID != courtID) {
			continue
		}
		out = append(out, *r.public())
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out
}

func (r *Room) finished() bool { return r.match != nil && r.match.Finished() }

func (r *Room) public() *Room {
	filled := 0
	for _, s := range r.slots {
		if s != "" {
			filled++
		}
	}
	return &Room{Code: r.Code, CourtID: r.CourtID, HostID: r.HostID, Sport: r.Sport, Size: r.Size, CreatedAt: r.CreatedAt, Players: len(r.members), Filled: filled, Started: r.match != nil}
}

func (r *Room) online(uid string) bool {
	for c := range r.members {
		if c.userID == uid {
			return true
		}
	}
	return false
}

func (r *Room) seat(uid string) int {
	for i, s := range r.slots {
		if s == uid {
			return i
		}
	}
	return -1
}

// claims maps each match player (by index) to the user who plays them.
func (r *Room) claims() map[string]string {
	out := map[string]string{}
	for i, s := range r.slots {
		if s != "" {
			out[strconv.Itoa(i)] = s
		}
	}
	return out
}

// lobbyState is the pre-match room every phone shows.
func (h *Hub) lobbyState(r *Room) map[string]any {
	ready, online := []string{}, []string{}
	seen := map[string]bool{}
	for _, s := range r.slots {
		if s == "" || seen[s] {
			continue
		}
		seen[s] = true
		if r.ready[s] {
			ready = append(ready, s)
		}
		if r.online(s) {
			online = append(online, s)
		}
	}
	var startIn any
	if !r.startAt.IsZero() {
		startIn = math.Max(0, math.Ceil(r.startAt.Sub(h.now()).Seconds()))
	}
	return map[string]any{"sport": r.Sport, "size": r.Size, "slots": r.slots, "ready": ready, "online": online, "start_in": startIn, "host_id": r.HostID, "court_id": r.CourtID}
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
	if m == nil {
		h.lobbyTickLocked(r, now)
		return
	}
	if !r.finishedAt.IsZero() && now.Sub(r.finishedAt) > 8*time.Second {
		return // the celebration is over; the final state is sent on join
	}
	m.Tick(real*m.Slow(), real)
	if m.Finished() && r.finishedAt.IsZero() {
		r.finishedAt = now
		if !r.awarded && h.deps.Award != nil {
			r.awarded = true
			go h.award(r, m.Results())
		}
	}
	if len(r.members) > 0 {
		h.roomcastLocked(r, nil, map[string]any{"t": "state", "s": m.Snapshot(r.claims())})
	}
}

// lobbyTickLocked counts down once every spot is a real player, online and
// ready, and starts the match when it reaches zero.
func (h *Hub) lobbyTickLocked(r *Room, now time.Time) {
	all := true
	for _, s := range r.slots {
		all = all && s != "" && r.ready[s] && r.online(s)
	}
	switch {
	case !all:
		r.startAt = time.Time{}
	case r.startAt.IsZero():
		r.startAt = now.Add(countdown)
	case !now.Before(r.startAt) && !r.loading:
		r.loading = true
		go h.start(r, append([]string(nil), r.slots...))
	}
	h.sendRoomLocked(r)
}

func (h *Hub) sendRoomLocked(r *Room) {
	st := h.lobbyState(r)
	b, _ := json.Marshal(st)
	if string(b) == r.lastRoom {
		return
	}
	r.lastRoom = string(b)
	h.roomcastLocked(r, nil, map[string]any{"t": "room", "r": st})
}

// start loads the players' attributes for the sport and kicks off.
func (h *Hub) start(r *Room, ids []string) {
	var entries []RosterEntry
	err := errors.New("no loader")
	if h.deps.Load != nil {
		ctx, cancel := context.WithTimeout(h.ctx, 10*time.Second)
		entries, err = h.deps.Load(ctx, r.Sport, ids)
		cancel()
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	r.loading = false
	if h.rooms[r.Code] != r {
		return
	}
	// Someone left or changed spots while loading: back to the lobby.
	same := len(entries) == len(r.slots)
	for i := range ids {
		same = same && ids[i] == r.slots[i] && strings.EqualFold(entries[i].ID, ids[i])
	}
	if err != nil || !same {
		r.startAt = time.Time{}
		return
	}
	var seed [8]byte
	_, _ = rand.Read(seed[:])
	m := NewSim(r.Sport, entries[:r.Size], entries[r.Size:], binary.LittleEndian.Uint64(seed[:]))
	// A player who is not connected right now has the AI play their turn.
	m.setHuman(func(i int) string {
		if i < 0 || i >= len(r.slots) || !r.online(r.slots[i]) {
			return ""
		}
		return r.slots[i]
	})
	r.match = m
	r.Started = true
	h.roomcastLocked(r, nil, map[string]any{"t": "state", "s": m.Snapshot(r.claims())})
}

// award records the results and tells each player what they earned.
func (h *Hub) award(r *Room, res []Result) {
	ctx, cancel := context.WithTimeout(h.ctx, 15*time.Second)
	defer cancel()
	out, err := h.deps.Award(ctx, r.Code+":"+strconv.FormatInt(r.CreatedAt.UnixNano(), 36), r.Sport, res)
	if err != nil {
		return
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	for c := range r.members {
		raw, ok := out[c.userID]
		if !ok {
			continue
		}
		msg := map[string]any{}
		if json.Unmarshal(raw, &msg) != nil {
			continue
		}
		msg["t"] = "award"
		h.sendLocked(c, msg)
	}
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
	if h.deps.Friends != nil {
		if ids, err := h.deps.Friends(ctx, c.userID); err == nil {
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
		if !r.finished() {
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
		// Before kick-off anyone in the room can take a free spot (or stand up).
		if r == nil || r.match != nil || r.loading {
			return
		}
		want := -1
		if m.K != nil && *m.K != "" {
			n, err := strconv.Atoi(*m.K)
			if err != nil || n < 0 || n >= len(r.slots) || (r.slots[n] != "" && r.slots[n] != c.userID) {
				return
			}
			want = n
		}
		if old := r.seat(c.userID); old >= 0 {
			r.slots[old] = ""
		}
		if want >= 0 {
			r.slots[want] = c.userID
		} else {
			delete(r.ready, c.userID)
		}
		h.sendRoomLocked(r)
	case "ready":
		if r == nil || r.match != nil || r.seat(c.userID) < 0 {
			return
		}
		if m.N == 1 {
			r.ready[c.userID] = true
		} else {
			delete(r.ready, c.userID)
		}
		h.sendRoomLocked(r)
	case "intent":
		if r != nil && r.match != nil {
			r.match.Choose(m.Q, m.I, c.userID)
		}
	case "react":
		if r != nil && reactions[m.E] {
			h.roomcastLocked(r, c, map[string]any{"t": "react", "from": c.userID, "e": m.E})
		}
	}
}

// checkAwaitLocked lets the AI play a turn whose player is not connected anymore.
func (h *Hub) checkAwaitLocked(r *Room) {
	if r.match == nil {
		return
	}
	if aw := r.match.awaiting(); aw != nil && !r.online(aw.who) {
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
	var state any
	if r.match != nil {
		state = r.match.Snapshot(r.claims())
	}
	h.sendLocked(c, map[string]any{"t": "joined", "code": r.Code, "court_id": r.CourtID, "host_id": r.HostID, "sport": r.Sport, "size": r.Size, "room": h.lobbyState(r), "state": state})
	r.lastRoom = ""
	h.membersLocked(r)
}

func (h *Hub) leaveLocked(c *conn) {
	r := c.room
	if r == nil {
		return
	}
	delete(r.members, c)
	c.room = nil
	// A player who left (all their tabs): before kick-off their spot opens
	// again; during the match the AI plays their turns until they're back.
	if !r.online(c.userID) {
		if r.match == nil && !r.loading {
			if i := r.seat(c.userID); i >= 0 {
				r.slots[i] = ""
			}
			delete(r.ready, c.userID)
			h.sendRoomLocked(r)
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
