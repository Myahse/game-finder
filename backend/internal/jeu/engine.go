package jeu

// The online match engine: the same rules as the web app's solo engine
// (web/src/jeu/engine.ts), run here so an online match never depends on one
// phone staying awake. Half court, 3 against 3, first to 15 (2 and 3 points);
// every decision and outcome comes from the players' attributes.

import (
	"math"
	"math/rand/v2"
	"sort"
	"strconv"
)

const (
	courtW = 370.0
	courtH = 380.0
	hoopX  = 185.0
	hoopY  = 36.0
	r3     = 160.0
	win    = 15
	rim    = 40.0
)

// Attrs are the six attributes (40–99) computed from real games.
type Attrs struct {
	Tir float64 `json:"tir"`
	Pen float64 `json:"pen"`
	Col float64 `json:"col"`
	Def float64 `json:"def"`
	End float64 `json:"end"`
	Men float64 `json:"men"`
}

// RosterEntry is one player of a match; ID is a user id or "bot-N".
type RosterEntry struct {
	ID   string
	Name string
	Num  int
	Big  bool
	A    Attrs
}

type stats struct{ pts, fgm, fga, tpm, tpa, ast, reb, stl, blk, to int }

type player struct {
	RosterEntry
	team, slot   int
	x, y, tx, ty float64
	stam         float64
	streak       int
	fire         bool
	st           stats
}

// FeedLine is a line of commentary: a key each phone turns into its own language.
type FeedLine struct {
	K    string `json:"k"`
	P    []int  `json:"p,omitempty"`
	S    []int  `json:"s,omitempty"`
	Team *int   `json:"team,omitempty"`
	N    *int   `json:"n,omitempty"`
	V    string `json:"v,omitempty"`
}

type Banner struct {
	K    string `json:"k"`
	P    *int   `json:"p,omitempty"`
	Team *int   `json:"team,omitempty"`
	S    []int  `json:"s,omitempty"`
	MS   int    `json:"ms"`
	N    int    `json:"n"`
}

type Moment struct {
	K string  `json:"k"`
	P []int   `json:"p"`
	S []int   `json:"s"`
	T float64 `json:"t"`
}

// Choice is [kind, target, success %, target's shot %] for a human's turn.
type Choice [4]any

type await struct {
	k, q     int
	who      string
	deadline float64 // match clock (seconds of real time since start)
	list     []Choice
	ops      []op
}

type op struct {
	kind string
	p    float64
	val  float64
	to   *player
}

type ball struct {
	mode                   string
	x, y, z, zb            float64
	fx, fy, tx, ty, dur, h float64
	to, from               *player
	steal, blocked         bool
	z0                     float64
}

type Tactics struct{ Pace, Focus, Def string }

type pendingShot struct {
	by, blocker          *player
	three, made, blocked bool
	dunk, layup          bool
	x, y                 float64
}

// Match is one online match, advanced by Update.
type Match struct {
	P             []*player
	score         [2]int
	off           int
	handler       *player
	phase         string
	pt            float64
	shotClock     float64
	b             ball
	feed          []FeedLine
	moments       []Moment
	poss          int
	hist          []int
	finished      bool
	gameT         float64
	slow          float64
	tactics       Tactics
	aw            *await
	timeoutOK     bool
	fxRing        [][6]any
	banner        *Banner
	fxN, bnN, awQ int
	aiNext        bool
	decisionT     float64
	celebrate     float64
	lastPass      *struct {
		from, to *player
		t        float64
	}
	pending *pendingShot
	evs     []struct {
		make bool
		p    *player
		v    int
	}
	rnd *rand.Rand
	// Who decides for a player: a user id, or "" for the AI.
	HumanFor func(idx int) string
	// Real seconds since the match started (turn deadlines don't follow speed).
	clock float64
}

func NewMatch(a, b []RosterEntry, seed uint64) *Match {
	m := &Match{phase: "check", shotClock: 8, slow: 1, tactics: Tactics{"norm", "bal", "man"}, timeoutOK: true, hist: []int{0}, rnd: rand.New(rand.NewPCG(seed, seed^0x9e3779b97f4a7c15))}
	for i, r := range a {
		m.P = append(m.P, m.mk(r, 0, i))
	}
	for i, r := range b {
		m.P = append(m.P, m.mk(r, 1, i))
	}
	if m.rnd.Float64() < 0.5 {
		m.off = 0
	} else {
		m.off = 1
	}
	m.say(FeedLine{K: "kickoff", Team: ip(m.off)})
	m.startPossession()
	m.fx("go", 0, 0, 0, 0)
	return m
}

func (m *Match) mk(r RosterEntry, team, slot int) *player {
	y := 300.0
	if team == 1 {
		y = 250
	}
	return &player{RosterEntry: r, team: team, slot: slot, x: 185 + float64(slot-1)*60, y: y, tx: 185, ty: 300, stam: 1}
}

func ip(v int) *int                     { return &v }
func clamp(v, a, b float64) float64     { return math.Max(a, math.Min(b, v)) }
func lerp(a, b, k float64) float64      { return a + (b-a)*k }
func isThree(x, y float64) bool         { return math.Hypot(x-hoopX, y-hoopY) >= r3-2 }
func (m *Match) r(a, b float64) float64 { return a + m.rnd.Float64()*(b-a) }
func (m *Match) team(i int) []*player {
	var out []*player
	for _, p := range m.P {
		if p.team == i {
			out = append(out, p)
		}
	}
	return out
}
func (m *Match) idx(p *player) int {
	for i, q := range m.P {
		if q == p {
			return i
		}
	}
	return -1
}
func (m *Match) guard(p *player) *player {
	for _, q := range m.P {
		if q.team != p.team && q.slot == p.slot {
			return q
		}
	}
	return m.P[0]
}
func dist(a, b *player) float64 { return math.Hypot(a.x-b.x, a.y-b.y) }
func dHoop(p *player) float64   { return math.Hypot(p.x-hoopX, p.y-hoopY) }
func (m *Match) nearestDef(p *player) (*player, float64) {
	var best *player
	d := 1e9
	for _, q := range m.team(1 - p.team) {
		if dd := dist(q, p); dd < d {
			best, d = q, dd
		}
	}
	return best, d
}

func (m *Match) say(l FeedLine) {
	m.feed = append([]FeedLine{l}, m.feed...)
	if len(m.feed) > 3 {
		m.feed = m.feed[:3]
	}
}
func (m *Match) sc() []int { return []int{m.score[0], m.score[1]} }
func (m *Match) moment(k string, ps ...*player) {
	ids := []int{}
	for _, p := range ps {
		ids = append(ids, m.idx(p))
	}
	m.moments = append(m.moments, Moment{K: k, P: ids, S: m.sc(), T: m.gameT})
}
func (m *Match) showBanner(b Banner) { m.bnN++; b.N = m.bnN; m.banner = &b }
func (m *Match) fx(t string, i int, x, y float64, e int) {
	m.fxN++
	m.fxRing = append(m.fxRing, [6]any{m.fxN, t, i, int(math.Round(x)), int(math.Round(y)), e})
	if len(m.fxRing) > 8 {
		m.fxRing = m.fxRing[1:]
	}
}

func (m *Match) startPossession() {
	m.poss++
	m.phase = "check"
	m.pt = 0
	m.shotClock = 8
	if m.off == 0 {
		m.shotClock = map[string]float64{"fast": 6, "norm": 8, "slow": 10}[m.tactics.Pace]
	}
	o, d := m.team(m.off), m.team(1-m.off)
	m.handler = o[0]
	for _, p := range o {
		if p.A.Col+p.A.Pen > m.handler.A.Col+m.handler.A.Pen {
			m.handler = p
		}
	}
	if m.rnd.Float64() < 0.35 {
		m.handler = o[m.rnd.IntN(len(o))]
	}
	spots := [][2]float64{{185, 232}, {64, 156}, {306, 156}, {32, 62}, {338, 62}}
	m.rnd.Shuffle(len(spots), func(i, j int) { spots[i], spots[j] = spots[j], spots[i] })
	for _, p := range o {
		if p == m.handler {
			p.tx, p.ty = 185+m.r(-20, 20), 300
		} else {
			s := spots[len(spots)-1]
			spots = spots[:len(spots)-1]
			p.tx, p.ty = s[0], s[1]
		}
	}
	for _, p := range d {
		for _, q := range o {
			if q.slot == p.slot {
				p.tx, p.ty = q.tx, q.ty-40
			}
		}
	}
	m.lastPass = nil
	m.b = ball{mode: "held", x: m.handler.x, y: m.handler.y, z: 8}
}

// ShotProb is the chance of a shot going in, from the shooter, the spot and the defense.
func (m *Match) shotProb(p *player, x, y float64) float64 {
	d, a := math.Hypot(x-hoopX, y-hoopY), p.A
	var pr float64
	switch {
	case d < 72:
		pr = 0.4 + a.Pen*0.0045
	case d < r3-2:
		pr = 0.27 + a.Tir*0.0036
	default:
		pr = 0.12 + a.Tir*0.0038
	}
	var dq *player
	nd := 1e9
	for _, q := range m.team(1 - p.team) {
		if dd := math.Hypot(q.x-x, q.y-y); dd < nd {
			dq, nd = q, dd
		}
	}
	press := 1.0
	if p.team == 1 && m.tactics.Def == "press" {
		press = 1.2
	}
	pr -= math.Max(0, (48-nd)/48) * (0.16 + dq.A.Def/650) * press
	pr *= 0.72 + 0.28*p.stam
	if p.fire {
		pr += 0.07
	}
	if math.Max(float64(m.score[0]), float64(m.score[1])) >= win-5 {
		pr += (a.Men - 66) * 0.003
	}
	if p.team == 0 {
		pr += 0.012
	}
	return clamp(pr, 0.05, 0.9)
}

func (m *Match) usage(q *player) float64 {
	t := 0
	for _, x := range m.team(q.team) {
		t += x.st.fga
	}
	if t < 3 {
		return 1
	}
	return clamp(1.3-float64(q.st.fga)/float64(t)*1.05, 0.55, 1.3)
}

func (m *Match) passSteal(a, b *player) float64 {
	mx, my := (a.x+b.x)/2, (a.y+b.y)/2
	best := 0.01
	for _, q := range m.team(1 - a.team) {
		dd := math.Hypot(q.x-mx, q.y-my)
		if dd > 46 {
			continue
		}
		f := 1.0
		if a.team == 1 && m.tactics.Def == "press" {
			f = 1.7
		}
		best = math.Max(best, (0.03+q.A.Def/1400)*(1-dd/46)*f)
	}
	return best * (1.15 - a.A.Col/300)
}

func (m *Match) options(h *player) []op {
	fo := "bal"
	if h.team == 0 {
		fo = m.tactics.Focus
	}
	uh := m.usage(h)
	pShot, three := m.shotProb(h, h.x, h.y), isThree(h.x, h.y)
	v, f := 2.0, 1.0
	if three {
		v = 3
		if fo == "out" {
			f = 1.3
		} else if fo == "in" {
			f = 0.7
		}
	}
	ops := []op{{kind: "shoot", p: pShot, val: pShot * v * uh * f}}
	if dHoop(h) > 70 {
		g2 := m.guard(h)
		extra := 0.0
		if h.team == 1 && m.tactics.Def == "press" {
			extra = 0.06
		}
		pd := clamp(0.38+h.A.Pen*0.0048-g2.A.Def*0.0026+extra, 0.12, 0.8)
		ff := 1.0
		if fo == "in" {
			ff = 1.3
		} else if fo == "out" {
			ff = 0.8
		}
		ops = append(ops, op{kind: "drive", p: pd, val: pd * 2 * uh * ff})
	}
	for _, q := range m.team(h.team) {
		if q == h {
			continue
		}
		_, open := m.nearestDef(q)
		ps, vv := m.shotProb(q, q.x, q.y), 2.0
		if isThree(q.x, q.y) {
			vv = 3
		}
		steal := m.passSteal(h, q)
		ops = append(ops, op{kind: "pass", to: q, p: 1 - steal, val: (ps*vv*0.9 + math.Min(open, 60)/400) * m.usage(q) * (1 - steal*2.2) * (0.85 + h.A.Col/400)})
	}
	return ops
}

func (m *Match) decide() {
	ops := m.options(m.handler)
	if m.shotClock <= 1.2 {
		m.act(ops[0])
		return
	}
	who := ""
	if !m.aiNext && m.HumanFor != nil {
		who = m.HumanFor(m.idx(m.handler))
	}
	m.aiNext = false
	if who != "" {
		m.awQ++
		list := make([]Choice, len(ops))
		for i, o := range ops {
			to, p2 := -1, 0
			if o.to != nil {
				to = m.idx(o.to)
				p2 = int(math.Round(m.shotProb(o.to, o.to.x, o.to.y) * 100))
			}
			list[i] = Choice{o.kind[:1], to, int(math.Round(o.p * 100)), p2}
		}
		m.aw = &await{k: m.idx(m.handler), q: m.awQ, who: who, deadline: m.clock + 7, list: list, ops: ops}
		return
	}
	best, bv := ops[0], -1.0
	for _, o := range ops {
		if v := o.val * m.r(0.82, 1.18); v > bv {
			best, bv = o, v
		}
	}
	m.act(best)
}

// Choose applies a human's choice for turn q (ignored if that turn is over or not theirs).
func (m *Match) Choose(q, i int, who string) bool {
	if m.aw == nil || m.aw.q != q || m.aw.who != who || i < 0 || i >= len(m.aw.ops) {
		return false
	}
	m.act(m.aw.ops[i])
	return true
}

// AITakesOver stops waiting for a human and lets the AI play the turn.
func (m *Match) AITakesOver() {
	if m.aw == nil {
		return
	}
	k := m.aw.k
	m.aw = nil
	m.say(FeedLine{K: "aiPlays", P: []int{k}})
	m.aiNext = true
	m.decisionT = 0
}

func (m *Match) act(o op) {
	m.aw = nil
	h := m.handler
	switch o.kind {
	case "shoot":
		m.release(h.x, h.y, false)
	case "drive":
		m.phase, m.pt = "drive", 0
		h.tx, h.ty = 185+m.r(-28, 28), 66
		h.stam = math.Max(0.2, h.stam-(100-h.A.End)*0.0009)
		g := m.guard(h)
		g.tx, g.ty = h.tx+m.r(-10, 10), h.ty-16
	case "pass":
		to := o.to
		steal := m.rnd.Float64() < m.passSteal(h, to)
		m.phase, m.pt = "pass", 0
		target := to
		if steal {
			mx, my := (h.x+to.x)/2, (h.y+to.y)/2
			d := 1e9
			for _, q := range m.team(1 - h.team) {
				if dd := math.Hypot(q.x-mx, q.y-my); dd < d {
					target, d = q, dd
				}
			}
		}
		m.b = ball{mode: "pass", fx: h.x, fy: h.y, to: target, from: h, steal: steal, dur: 0.28 + dist(h, to)/900, x: h.x, y: h.y, z: 10, zb: 6}
	}
}

func (m *Match) release(x, y float64, layup bool) {
	h := m.handler
	three, d := isThree(x, y), math.Hypot(x-hoopX, y-hoopY)
	nq, nd := m.nearestDef(h)
	dunk := layup && h.A.Pen >= 72 && h.stam > 0.5 && m.rnd.Float64() < 0.45
	blockP := 0.0
	reach := 24.0
	if layup {
		reach = 34
	}
	if nd < reach {
		if layup {
			blockP = 0.05 + nq.A.Def/650
		} else {
			blockP = 0.02 + nq.A.Def/1500
		}
	}
	pr := m.shotProb(h, x, y)
	if dunk {
		pr = math.Min(0.94, pr+0.2)
	}
	blocked := m.rnd.Float64() < blockP
	made := !blocked && m.rnd.Float64() < pr
	h.st.fga++
	if three {
		h.st.tpa++
	}
	v := 2
	if three {
		v = 3
	}
	winning := made && m.score[h.team]+v >= win
	m.pending = &pendingShot{by: h, three: three, made: made, blocked: blocked, blocker: nq, dunk: dunk, layup: layup, x: x, y: y}
	m.phase, m.pt = "shot", 0
	dur, hh := 0.62, 70.0
	switch {
	case blocked:
		dur, hh = 0.22, 14
	case dunk:
		dur, hh = 0.3, 26
	case layup:
		dur, hh = 0.45, 34
	case d > r3:
		dur, hh = 0.78, 92
	}
	tx, ty := hoopX, hoopY
	if blocked {
		tx, ty = nq.x, nq.y-8
	}
	m.b = ball{mode: "shot", fx: x, fy: y - 6, tx: tx, ty: ty, dur: dur, h: hh, blocked: blocked, x: x, y: y, z: 10}
	if winning {
		m.slow = 0.32
	}
	h.stam = math.Max(0.2, h.stam-0.012)
	e := 0
	if dunk {
		e = 1
	}
	m.fx("rel", m.idx(h), x, y, e)
}

func (m *Match) landed() {
	s := m.pending
	p, i := s.by, m.idx(s.by)
	m.slow = 1
	if s.blocked {
		s.blocker.st.blk++
		m.fx("bk", i, s.x, s.y, m.idx(s.blocker))
		m.say(FeedLine{K: "block", P: []int{m.idx(s.blocker), i}})
		m.moment("block", s.blocker, p)
		m.showBanner(Banner{K: "block", P: ip(m.idx(s.blocker)), MS: 900})
		p.streak, p.fire = 0, false
		m.rebound(true)
		return
	}
	if s.made {
		v := 2
		if s.three {
			v = 3
		}
		m.score[p.team] += v
		p.st.pts += v
		p.st.fgm++
		if s.three {
			p.st.tpm++
		}
		var ast *player
		if m.lastPass != nil && m.lastPass.to == p && m.gameT-m.lastPass.t < 3.2 {
			ast = m.lastPass.from
			ast.st.ast++
		}
		p.streak++
		e := v
		if s.dunk {
			e = 4
		}
		m.fx("mk", i, s.x, s.y, e)
		k := "jumper"
		switch {
		case s.dunk:
			k = "dunk"
		case s.three:
			k = "three"
		case s.layup:
			k = "layup"
		}
		if ast != nil {
			m.say(FeedLine{K: k + "Ast", P: []int{i, m.idx(ast)}, S: m.sc()})
		} else {
			m.say(FeedLine{K: k, P: []int{i}, S: m.sc()})
		}
		m.evs = append(m.evs, struct {
			make bool
			p    *player
			v    int
		}{true, p, v})
		if s.dunk || s.three {
			if ast != nil {
				m.moment(k, p, ast)
			} else {
				m.moment(k, p)
			}
		}
		if s.dunk {
			m.showBanner(Banner{K: "dunk", P: ip(i), MS: 1100})
		}
		if p.streak == 3 && !p.fire {
			p.fire = true
			m.say(FeedLine{K: "fire", P: []int{i}})
			m.moment("fire", p)
			if !s.dunk {
				m.showBanner(Banner{K: "fire", P: ip(i), MS: 1100})
			}
		}
		m.hist = append(m.hist, m.score[0]-m.score[1])
		if m.score[p.team] >= win {
			m.finish(p)
			return
		}
		if run := m.runOf(p.team); run >= 7 {
			m.say(FeedLine{K: "run", N: ip(run), Team: ip(p.team)})
			m.moment("run", p)
		}
		if m.score[p.team] >= win-3 && m.score[p.team]-v < win-3 {
			m.showBanner(Banner{K: "matchPoint", Team: ip(p.team), MS: 900})
		}
		m.celebrate, m.phase, m.pt, m.off = 0.5, "celebrate", 0, 1-p.team
		return
	}
	m.fx("ms", i, s.x, s.y, 0)
	p.streak, p.fire = 0, false
	k := "miss"
	if s.three {
		k = "miss3"
	} else if s.layup {
		k = "missLayup"
	}
	m.say(FeedLine{K: k, P: []int{i}})
	m.evs = append(m.evs, struct {
		make bool
		p    *player
		v    int
	}{false, p, 0})
	m.rebound(false)
}

func (m *Match) runOf(t int) int {
	r := 0
	for i := len(m.evs) - 1; i >= 0; i-- {
		e := m.evs[i]
		if !e.make {
			continue
		}
		if e.p.team != t {
			break
		}
		r += e.v
	}
	return r
}

func (m *Match) rebound(blocked bool) {
	a, r := m.r(0.15, math.Pi-0.15), m.r(26, 78)
	z0 := rim
	if blocked {
		z0 = 10
	}
	m.b = ball{mode: "loose", x: hoopX, y: hoopY, tx: hoopX + math.Cos(a)*r, ty: hoopY + math.Sin(a)*r + 6, zb: z0, z0: z0}
	for _, p := range m.P {
		if math.Hypot(p.x-m.b.tx, p.y-m.b.ty) < 150 {
			p.tx, p.ty = m.b.tx+m.r(-14, 14), m.b.ty+m.r(-10, 14)
		}
	}
	m.phase, m.pt = "rebound", 0
}

func (m *Match) grabRebound() {
	var pool []*player
	for _, p := range m.P {
		if math.Hypot(p.x-m.b.tx, p.y-m.b.ty) < 110 {
			pool = append(pool, p)
		}
	}
	if len(pool) == 0 {
		pool = m.P
	}
	w, sum := make([]float64, len(pool)), 0.0
	for i, p := range pool {
		big := 0.0
		if p.Big {
			big = 25
		}
		f := 1.0
		if p.team == m.off {
			f = 0.72
		}
		w[i] = ((p.A.End + p.A.Def*0.5 + big) / 100) * (1 / (math.Hypot(p.x-m.b.tx, p.y-m.b.ty) + 18)) * f * (0.6 + 0.4*p.stam)
		sum += w[i]
	}
	r, who := m.rnd.Float64()*sum, pool[0]
	for i := range pool {
		r -= w[i]
		if r <= 0 {
			who = pool[i]
			break
		}
	}
	who.st.reb++
	m.hist = append(m.hist, m.score[0]-m.score[1])
	if who.team == m.off {
		m.say(FeedLine{K: "orb", P: []int{m.idx(who)}})
		m.handler = who
		m.b = ball{mode: "held", x: who.x, y: who.y, z: 8}
		if dHoop(who) < 70 && m.rnd.Float64() < 0.4+who.A.Pen/400 {
			m.release(who.x, who.y, true)
			return
		}
		m.phase, m.pt, m.shotClock, m.decisionT = "play", 0, 5, 0.5
	} else {
		m.say(FeedLine{K: "drb", P: []int{m.idx(who)}})
		m.off = who.team
		m.startPossession()
		m.handler = who
		m.b = ball{mode: "held", x: who.x, y: who.y, z: 8}
	}
}

func (m *Match) finish(p *player) {
	m.finished, m.phase, m.pt = true, "over", 0
	w := p.team
	m.say(FeedLine{K: "win", Team: ip(w), S: m.sc()})
	m.moment("win", p)
	m.fx("win", m.idx(p), 0, 0, 0)
	k := "win"
	if w == 1 {
		k = "lose"
	}
	m.showBanner(Banner{K: k, Team: ip(w), S: m.sc(), MS: 2600})
}

// Timeout is the coach's one timeout for team A: +15 % stamina.
func (m *Match) Timeout() bool {
	if !m.timeoutOK || m.finished {
		return false
	}
	m.timeoutOK = false
	for _, p := range m.team(0) {
		p.stam = math.Min(1, p.stam+0.15)
	}
	m.say(FeedLine{K: "timeout", Team: ip(0)})
	m.moment("timeout", m.P[0])
	m.showBanner(Banner{K: "timeout", Team: ip(0), MS: 1500})
	return true
}

// SetTactic changes team A's tactics (pace, focus or def).
func (m *Match) SetTactic(k, v string) bool {
	ok := map[string][]string{"pace": {"fast", "norm", "slow"}, "focus": {"out", "bal", "in"}, "def": {"man", "press"}}[k]
	found := false
	for _, x := range ok {
		found = found || x == v
	}
	if !found {
		return false
	}
	switch k {
	case "pace":
		m.tactics.Pace = v
	case "focus":
		m.tactics.Focus = v
	case "def":
		m.tactics.Def = v
	}
	m.say(FeedLine{K: "coach", Team: ip(0), V: v})
	return true
}

// Tick advances the match: dt of match time, real seconds for turn deadlines.
func (m *Match) Tick(dt, real float64) {
	m.clock += real
	m.update(dt)
}

func (m *Match) update(dt float64) {
	m.gameT += dt
	m.pt += dt
	pace := 1.0
	if m.tactics.Pace == "fast" {
		pace = 1.25
	} else if m.tactics.Pace == "slow" {
		pace = 0.85
	}
	for _, p := range m.P {
		tp := 1.0
		if p.team == 0 {
			tp = pace
		}
		sp := 145 * (0.75 + p.A.Pen/400) * (0.62 + 0.38*p.stam) * tp
		dx, dy := p.tx-p.x, p.ty-p.y
		d := math.Hypot(dx, dy)
		if d > 1 {
			mv := math.Min(d, sp*dt)
			p.x += dx / d * mv
			p.y += dy / d * mv
			pr := 1.0
			if p.team == 0 && m.tactics.Def == "press" {
				pr = 1.25
			}
			p.stam = math.Max(0.2, p.stam-dt*(100-p.A.End)/100*0.006*pr*tp)
		} else {
			p.stam = math.Min(1, p.stam+dt*0.004)
		}
	}
	if m.phase == "check" || m.phase == "play" || m.phase == "drive" || m.phase == "pass" {
		for _, dfd := range m.team(1 - m.off) {
			var mm *player
			for _, q := range m.P {
				if q.team == m.off && q.slot == dfd.slot {
					mm = q
				}
			}
			press := 0.26
			if dfd.team == 0 && m.tactics.Def == "press" {
				press = 0.16
			}
			k := press + 0.12
			if mm == m.handler {
				k = press
			}
			dfd.tx, dfd.ty = mm.x+(hoopX-mm.x)*k, mm.y+(hoopY-mm.y)*k
		}
	}
	h := m.handler
	switch m.phase {
	case "check":
		m.b = ball{mode: "held", x: h.x, y: h.y, z: 8}
		if m.pt > 0.45 {
			m.phase, m.pt, m.decisionT = "play", 0, 0.25
		}
	case "play":
		if m.aw != nil {
			if m.clock > m.aw.deadline {
				m.AITakesOver()
			}
			break
		}
		m.shotClock -= dt
		m.decisionT -= dt
		for _, p := range m.team(m.off) {
			if p != h && m.rnd.Float64() < dt*0.45 {
				pool := [][2]float64{{185, 232}, {64, 156}, {306, 156}, {32, 62}, {338, 62}}
				in := 0.35
				if p.team == 0 && m.tactics.Focus == "in" {
					in = 0.6
				}
				if m.rnd.Float64() < in {
					pool = [][2]float64{{124, 140}, {246, 140}, {108, 70}, {262, 70}, {185, 160}}
				}
				s := pool[m.rnd.IntN(len(pool))]
				p.tx, p.ty = s[0], s[1]
			}
		}
		if h.ty > 250 {
			h.ty = 240
		}
		if m.decisionT <= 0 {
			f := 1.0
			if h.team == 0 {
				if m.tactics.Pace == "fast" {
					f = 0.7
				} else if m.tactics.Pace == "slow" {
					f = 1.3
				}
			}
			m.decisionT = m.r(0.28, 0.6) * f
			m.decide()
		}
	case "drive":
		if math.Hypot(h.x-h.tx, h.y-h.ty) < 8 || m.pt > 0.9 {
			gd := m.guard(h)
			extra := 0.0
			if h.team == 1 && m.tactics.Def == "press" {
				extra = -0.06
			}
			if m.rnd.Float64() < clamp(gd.A.Def/210-h.A.Pen/320+extra+0.12, 0.05, 0.45) {
				var mates []*player
				for _, q := range m.team(m.off) {
					if q != h {
						mates = append(mates, q)
					}
				}
				mate := mates[m.rnd.IntN(len(mates))]
				m.say(FeedLine{K: "kickOut", P: []int{m.idx(h)}})
				m.b = ball{mode: "pass", fx: h.x, fy: h.y, to: mate, from: h, dur: 0.35, x: h.x, y: h.y, z: 10, zb: 6}
				m.phase, m.pt = "pass", 0
			} else {
				m.release(h.x, h.y, true)
			}
		}
	case "pass":
		k := math.Min(1, m.pt/m.b.dur)
		m.b.x, m.b.y = lerp(m.b.fx, m.b.to.x, k), lerp(m.b.fy, m.b.to.y, k)
		m.b.z = 10 + math.Sin(k*math.Pi)*10
		if k >= 1 {
			if m.b.steal {
				th := m.b.to
				th.st.stl++
				m.b.from.st.to++
				m.fx("st", m.idx(th), 0, 0, 0)
				m.say(FeedLine{K: "steal", P: []int{m.idx(th)}})
				m.moment("steal", th)
				m.showBanner(Banner{K: "steal", P: ip(m.idx(th)), MS: 800})
				m.hist = append(m.hist, m.score[0]-m.score[1])
				m.off = th.team
				m.startPossession()
				m.handler = th
			} else {
				m.lastPass = &struct {
					from, to *player
					t        float64
				}{m.b.from, m.b.to, m.gameT}
				m.handler = m.b.to
				m.b = ball{mode: "held", x: m.handler.x, y: m.handler.y, z: 8}
				m.phase, m.pt, m.decisionT = "play", 0, m.r(0.25, 0.6)
			}
		}
	case "shot":
		k := math.Min(1, m.pt/m.b.dur)
		m.b.x, m.b.y = lerp(m.b.fx, m.b.tx, k), lerp(m.b.fy, m.b.ty, k)
		m.b.z = 10 + math.Sin(k*math.Pi)*m.b.h*(1-k*0.4)
		top := rim - 10
		if m.b.blocked {
			top = 20
		}
		m.b.zb = top * k
		if k >= 1 {
			m.landed()
		}
	case "rebound":
		k := math.Min(1, m.pt/0.5)
		m.b.x, m.b.y = lerp(hoopX, m.b.tx, k), lerp(hoopY, m.b.ty, k)
		m.b.z = math.Abs(math.Sin(k*math.Pi*2)) * 22 * (1 - k)
		m.b.zb = m.b.z0 * (1 - k) * (1 - k)
		if m.pt > 0.62 {
			m.grabRebound()
		}
	case "celebrate":
		m.b.zb = math.Max(0, m.b.zb-dt*110)
		m.b.z = math.Max(0, m.b.z-dt*30)
		if m.pt > m.celebrate {
			m.startPossession()
		}
	case "over":
		wt := 1
		if m.score[0] >= win {
			wt = 0
		}
		for _, p := range m.P {
			if p.team == wt {
				p.tx = 185 + math.Cos(m.gameT+float64(p.slot)*2)*40
				p.ty = 190 + math.Sin(m.gameT*2+float64(p.slot))*20
			}
		}
		m.b.zb = math.Max(0, m.b.zb-dt*110)
	}
	if m.b.mode == "held" && m.handler != nil {
		hb := m.handler
		off := 10.0
		if hb.team == 1 {
			off = -10
		}
		m.b.x, m.b.y = hb.x+off, hb.y+6
		m.b.z, m.b.zb = 2+math.Abs(math.Sin(m.gameT*10))*8, 0
	}
}

func (m *Match) momentum() int {
	r := m.hist
	if len(r) > 6 {
		r = r[len(r)-6:]
	}
	return int(math.Round(clamp(50+float64(r[len(r)-1]-r[0])*7, 8, 92)))
}

// Snapshot is the state phones draw, in the web app's Snap format (snapshot.ts).
func (m *Match) Snapshot(claims map[string]string, creatorIdx int) map[string]any {
	rd := func(v float64) int { return int(math.Round(v)) }
	ro := make([][3]any, len(m.P))
	pl := make([][14]int, len(m.P))
	for i, p := range m.P {
		ro[i] = [3]any{p.ID, p.Name, p.Num}
		f := 0
		if p.fire {
			f = 1
		}
		pl[i] = [14]int{rd(p.x), rd(p.y), rd(p.stam * 100), p.st.pts, p.st.reb, p.st.ast, p.st.stl, p.st.blk, p.st.fgm, p.st.fga, f, p.st.tpm, p.st.tpa, p.st.to}
	}
	var ps any
	if m.b.mode == "pass" && m.b.to != nil && m.b.from != nil {
		ps = []int{m.idx(m.b.from), m.idx(m.b.to)}
	}
	var aw any
	if m.aw != nil {
		aw = map[string]any{"k": m.aw.k, "q": m.aw.q, "who": m.aw.who, "t": int(math.Max(0, math.Ceil(m.aw.deadline-m.clock))), "o": m.aw.list}
	}
	var end any
	fin := 0
	if m.finished {
		fin = 1
		end = m.moments
	}
	cl := map[string]string{}
	keys := make([]string, 0, len(claims))
	for k := range claims {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		cl[k] = claims[k]
	}
	return map[string]any{
		"v": 1, "ro": ro, "s": m.sc(), "ph": m.phase, "off": m.off, "po": m.poss, "h": m.idx(m.handler),
		"sc": rd(m.shotClock * 10), "hk": creatorIdx,
		"b": []int{rd(m.b.x), rd(m.b.y), rd(m.b.z), rd(m.b.zb)}, "bm": m.b.mode, "ps": ps, "pl": pl,
		"fd": m.feed, "bn": m.banner, "fx": m.fxRing, "cl": cl, "mo": m.momentum(), "aw": aw, "fin": fin, "end": end,
		"tm": map[string]any{"pace": m.tactics.Pace, "focus": m.tactics.Focus, "def": m.tactics.Def, "to": !m.timeoutOK},
	}
}

// Finished reports whether a team reached 15.
func (m *Match) Finished() bool { return m.finished }

// Slow is the slow-motion factor on a winning shot.
func (m *Match) Slow() float64 { return m.slow }

// BotRoster is a stand-in when a court or a friend list is short: an average
// player of the court (same formula as the web app's botRoster).
func BotRoster(n int, name string, seed int) RosterEntry {
	v := func(k int) float64 { return float64(52 + (n*7+k*13+seed)%11) }
	return RosterEntry{ID: "bot-" + strconv.Itoa(n), Name: name + " " + strconv.Itoa(n), Num: 40 + n, Big: n%3 == 2,
		A: Attrs{Tir: v(1), Pen: v(2), Col: v(3), Def: v(4), End: v(5), Men: v(6)}}
}
