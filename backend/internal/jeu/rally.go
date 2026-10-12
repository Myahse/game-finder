package jeu

// The rally engine for net sports (volleyball, tennis, badminton), the same
// rules as the web app's web/src/jeu/rally.ts. Full court, the net across the
// middle: team A on the near half, team B on the far half. Every hit is a
// choice (power, placed or safe); errors, winners and returns come from the
// players' attributes.

import (
	"math"
	"math/rand/v2"
)

const netY = courtH / 2

type rallyRules struct {
	win    int
	flight [2]float64
	arc    float64
}

var rallyRulesBy = map[string]rallyRules{
	"volleyball": {11, [2]float64{0.55, 0.85}, 90},
	"tennis":     {7, [2]float64{0.55, 0.8}, 34},
	"badminton":  {11, [2]float64{0.45, 1.0}, 80},
}

// IsNetSport reports whether a sport is played over a net (the rally engine).
func IsNetSport(s string) bool { _, ok := rallyRulesBy[s]; return ok }

type rallyFlight struct {
	from        *player
	shot        string // s power, d placed, p safe
	tx, ty, dur float64
	out         string // in, err, winner
	fx, fy      float64
	serve       bool
	blockBy     *player
}

// Rally is one online net-sport match.
type Rally struct {
	sport    string
	rules    rallyRules
	P        []*player
	score    [2]int
	off      int // the serving team
	handler  *player
	phase    string
	pt       float64
	b        ball
	feed     []FeedLine
	moments  []Moment
	poss     int
	hist     []int
	finished bool
	gameT    float64
	tactics  Tactics
	aw       *await
	fxRing   [][6]any
	banner   *Banner
	fxN, bnN int
	awQ      int
	aiNext   bool
	wait     float64
	touches  int
	streak   [2]int
	fl       *rallyFlight
	next     *player
	arc      float64
	quality  float64
	rnd      *rand.Rand
	HumanFor func(idx int) string
	clock    float64
}

// NewRally starts a net-sport match between two teams of the same size.
func NewRally(sport string, a, b []RosterEntry, seed uint64) *Rally {
	m := &Rally{sport: sport, rules: rallyRulesBy[sport], phase: "serve", tactics: Tactics{"norm", "bal", "man"}, hist: []int{0}, quality: 0.7, arc: 40,
		rnd: rand.New(rand.NewPCG(seed, seed^0x9e3779b97f4a7c15))}
	for i, r := range a {
		m.P = append(m.P, &player{RosterEntry: r, team: 0, slot: i, x: 185, y: 300, stam: 1})
	}
	for i, r := range b {
		m.P = append(m.P, &player{RosterEntry: r, team: 1, slot: i, x: 185, y: 80, stam: 1})
	}
	if m.rnd.Float64() >= 0.5 {
		m.off = 1
	}
	m.say(FeedLine{K: "kickoff", Team: ip(m.off)})
	m.setupServe()
	for _, p := range m.P {
		p.x, p.y = p.tx, p.ty
	}
	m.fx("go", 0, 0, 0, 0)
	return m
}

func (m *Rally) r(a, b float64) float64 { return a + m.rnd.Float64()*(b-a) }
func (m *Rally) team(i int) []*player {
	var out []*player
	for _, p := range m.P {
		if p.team == i {
			out = append(out, p)
		}
	}
	return out
}
func (m *Rally) idx(p *player) int {
	for i, q := range m.P {
		if q == p {
			return i
		}
	}
	return -1
}
func (m *Rally) sc() []int { return []int{m.score[0], m.score[1]} }
func (m *Rally) say(l FeedLine) {
	m.feed = append([]FeedLine{l}, m.feed...)
	if len(m.feed) > 3 {
		m.feed = m.feed[:3]
	}
}
func (m *Rally) moment(k string, ps ...*player) {
	ids := []int{}
	for _, p := range ps {
		ids = append(ids, m.idx(p))
	}
	m.moments = append(m.moments, Moment{K: k, P: ids, S: m.sc(), T: m.gameT})
}
func (m *Rally) showBanner(b Banner) { m.bnN++; b.N = m.bnN; m.banner = &b }
func (m *Rally) fx(t string, i int, x, y float64, e int) {
	m.fxN++
	m.fxRing = append(m.fxRing, [6]any{m.fxN, t, i, int(math.Round(x)), int(math.Round(y)), e})
	if len(m.fxRing) > 8 {
		m.fxRing = m.fxRing[1:]
	}
}

// closest is the player of team t nearest to (x, y).
func (m *Rally) closest(t int, x, y float64) *player {
	var best *player
	d := 1e9
	for _, p := range m.team(t) {
		if dd := math.Hypot(p.x-x, p.y-y); dd < d {
			best, d = p, dd
		}
	}
	return best
}

func (m *Rally) home(p *player) (float64, float64) {
	n := len(m.team(p.team))
	x := 185.0
	if n > 1 {
		x = 70 + 230/float64(n-1)*float64(p.slot)
	}
	depth := 0.8
	if m.sport == "volleyball" {
		depth = 0.3
		if p.slot%2 == 1 {
			depth = 0.55
		}
	}
	if p.team == 0 {
		return x, netY + (courtH-netY)*depth
	}
	return x, netY - netY*depth
}

func (m *Rally) setupServe() {
	m.phase, m.pt, m.touches = "serve", 0, 0
	m.poss++
	t := m.team(m.off)
	m.handler = t[(m.poss+len(t))%len(t)]
	for _, p := range m.P {
		p.tx, p.ty = m.home(p)
	}
	s := m.handler
	if m.sport == "volleyball" {
		s.tx = 185 + m.r(-60, 60)
	} else if s.slot%2 == 1 {
		s.tx = 250
	} else {
		s.tx = 120
	}
	s.ty = 10
	if s.team == 0 {
		s.ty = courtH - 10
	}
	m.b = ball{mode: "held", x: s.tx, y: s.ty, z: 22}
	m.wait = 0.7
}

// odds are the [error, winner] chances of a hit (q: how easy the incoming ball is, 0..1).
func (m *Rally) odds(p *player, shot string, q float64, serve bool) (float64, float64) {
	agg := "bal"
	if p.team == 0 {
		agg = m.tactics.Focus
	}
	var skill, e, w float64
	switch {
	case serve:
		skill, e, w = p.A.Pen, 0.1, 0.08
	case shot == "s":
		skill, e, w = p.A.Tir, 0.22, 0.3
	case shot == "d":
		skill, e, w = p.A.Col, 0.16, 0.2
	default:
		skill, e, w = p.A.Def, 0.07, 0.05
	}
	skill /= 100
	e *= (1.6 - 1.2*skill) * (1.3 - 0.3*q) * (1.25 - 0.25*p.stam)
	w *= (0.4 + skill*1.1) * (0.7 + 0.3*q)
	if agg == "out" {
		e, w = e*1.2, w*1.25
	} else if agg == "in" {
		e, w = e*0.8, w*0.8
	}
	if math.Max(float64(m.score[0]), float64(m.score[1])) >= float64(m.rules.win-2) {
		e *= 1.15 - (p.A.Men-60)*0.004
	}
	return clamp(e, 0.02, 0.6), clamp(w, 0.02, 0.6)
}

var rallyShots = []string{"s", "d", "p"}

func (m *Rally) decide() {
	p, q := m.handler, m.quality
	if m.sport == "volleyball" && m.touches < 2 {
		m.hit("p", true, false) // reception, then the set: automatic
		return
	}
	who := ""
	if !m.aiNext && m.HumanFor != nil {
		who = m.HumanFor(m.idx(p))
	}
	m.aiNext = false
	if who != "" {
		m.awQ++
		list := make([]Choice, 3)
		for i, k := range rallyShots {
			e, w := m.odds(p, k, q, false)
			list[i] = Choice{k, -1, int(math.Round((1 - e) * 100)), int(math.Round(w * 100))}
		}
		m.aw = &await{k: m.idx(p), q: m.awQ, who: who, deadline: m.clock + 7, list: list}
		return
	}
	best, bv := "p", -1.0
	for _, k := range rallyShots {
		e, w := m.odds(p, k, q, false)
		if v := ((1-e)*(0.5+w*1.6) - e*0.6) * m.r(0.85, 1.15); v > bv {
			best, bv = k, v
		}
	}
	m.hit(best, false, false)
}

// Choose applies a human's hit for turn q (ignored if that turn is over or not theirs).
func (m *Rally) Choose(q, i int, who string) bool {
	if m.aw == nil || m.aw.q != q || m.aw.who != who || i < 0 || i > 2 {
		return false
	}
	m.aw = nil
	m.hit(rallyShots[i], false, false)
	return true
}

// AITakesOver stops waiting for a human and lets the AI play the hit.
func (m *Rally) AITakesOver() {
	if m.aw == nil {
		return
	}
	k := m.aw.k
	m.aw = nil
	m.say(FeedLine{K: "aiPlays", P: []int{k}})
	m.aiNext = true
	m.wait = 0
}

func (m *Rally) hit(shot string, internal, serve bool) {
	p, q := m.handler, m.quality
	if internal {
		// volleyball: the reception, then the set to a teammate near the net
		m.touches++
		to := p
		for _, x := range m.team(p.team) {
			if x != p && (to == p || math.Abs(x.y-netY) < math.Abs(to.y-netY)) {
				to = x
			}
		}
		ty := netY - 45
		if p.team == 0 {
			ty = netY + 45
		}
		tx := clamp(to.x+m.r(-30, 30), 40, 330)
		e := clamp(0.05-p.A.Col/2500, 0.01, 0.1)
		if m.touches == 1 {
			e = clamp(0.12-p.A.Def/1200+(1-q)*0.12, 0.02, 0.3)
			p.st.reb++
		} else {
			p.st.ast++
		}
		out := "in"
		if m.rnd.Float64() < e {
			out = "err"
		}
		m.fl = &rallyFlight{from: p, shot: shot, tx: tx, ty: ty, dur: 0.55, out: out, fx: p.x, fy: p.y}
		to.tx, to.ty = tx, ty
		m.next = to
		m.startFlight(30 + m.rules.arc*0.4)
		return
	}
	var eP, wP float64
	if serve {
		eP, wP = m.odds(p, "p", 1, true)
	} else {
		eP, wP = m.odds(p, shot, q, false)
	}
	out := "in"
	if roll := m.rnd.Float64(); roll < eP {
		out = "err"
	} else if roll < eP+wP {
		out = "winner"
	}
	far := p.team == 0
	var deep float64
	switch shot {
	case "d":
		deep = m.r(0.15, 0.35)
	case "s":
		deep = m.r(0.45, 0.9)
	default:
		deep = m.r(0.6, 0.95)
	}
	ty := netY + (courtH-netY)*deep
	if far {
		ty = netY - netY*deep
	}
	spread := 150.0
	if shot == "p" {
		spread = 90
	}
	tx := clamp(185+m.r(-1, 1)*spread, 20, 350)
	var blockBy *player
	if m.sport == "volleyball" && shot == "s" && out != "err" {
		front := m.team(1 - p.team)[0]
		for _, x := range m.team(1 - p.team) {
			if math.Abs(x.y-netY) < math.Abs(front.y-netY) {
				front = x
			}
		}
		if m.rnd.Float64() < clamp(0.08+front.A.Def/700-p.A.Tir/900, 0.03, 0.25) {
			blockBy, out = front, "winner"
		}
	}
	p.st.fga++
	m.touches = 0
	d0, d1 := m.rules.flight[0], m.rules.flight[1]
	dur := d1
	if shot == "s" {
		dur = d0
	} else if shot == "d" {
		dur = (d0 + d1) / 2
	}
	ftx, fty := tx, ty
	if out == "err" {
		if m.rnd.Float64() < 0.5 {
			ftx = clamp(tx+m.r(-1, 1)*220, -60, 430)
		}
		if m.rnd.Float64() < 0.5 {
			fty = netY - 6
			if far {
				fty = netY + 6
			}
		} else if far {
			fty = ty - 60
		} else {
			fty = ty + 60
		}
	}
	if blockBy != nil {
		dur = 0.3
	}
	m.fl = &rallyFlight{from: p, shot: shot, tx: ftx, ty: fty, dur: dur, out: out, fx: p.x, fy: p.y, serve: serve, blockBy: blockBy}
	recv := m.closest(1-p.team, tx, ty)
	m.next = recv
	if blockBy == nil {
		recv.tx, recv.ty = tx, ty
	}
	cost := 0.008
	if shot == "s" {
		cost = 0.02
	}
	p.stam = math.Max(0.25, p.stam-cost*(1.3-p.A.End/100))
	e := 0
	if shot == "s" {
		e = 1
	}
	m.fx("rel", m.idx(p), p.x, p.y, e)
	arc := m.rules.arc
	if shot == "s" {
		arc *= 0.45
	} else if shot == "d" {
		arc *= 0.75
	}
	m.startFlight(arc)
}

func (m *Rally) startFlight(arc float64) {
	f := m.fl
	m.arc = arc
	m.phase, m.pt = "flight", 0
	m.b = ball{mode: "shot", x: f.fx, y: f.fy, z: 26, fx: f.fx, fy: f.fy, tx: f.tx, ty: f.ty, dur: f.dur}
}

func (m *Rally) internal(f *rallyFlight) bool { return (f.from.team == 0) == (f.ty > netY) }

func (m *Rally) land() {
	f := m.fl
	p, i, other := f.from, m.idx(f.from), 1-f.from.team
	m.fl = nil
	if f.out == "err" {
		p.st.to++
		m.fx("ms", i, f.tx, f.ty, 0)
		k := "out"
		if f.ty > netY-8 && f.ty < netY+8 {
			k = "net"
		}
		m.say(FeedLine{K: k, P: []int{i}})
		m.point(other, nil)
		return
	}
	if b := f.blockBy; b != nil {
		b.st.blk++
		b.st.pts++
		m.fx("bk", i, f.fx, f.fy, m.idx(b))
		m.say(FeedLine{K: "block", P: []int{m.idx(b), i}})
		m.moment("block", b, p)
		m.showBanner(Banner{K: "block", P: ip(m.idx(b)), MS: 900})
		m.point(other, b)
		return
	}
	if f.out == "winner" && !m.internal(f) {
		p.st.pts++
		p.st.fgm++
		if f.serve {
			p.st.tpm++
		}
		if m.sport == "badminton" && f.shot == "s" {
			p.st.tpm++
		}
		e, k := 2, "winner"
		switch {
		case f.serve:
			e, k = 3, "ace"
		case f.shot == "s":
			e, k = 4, "smash"
		case f.shot == "d":
			k = "drop"
		}
		m.fx("mk", i, f.tx, f.ty, e)
		s := m.sc()
		s[p.team]++
		m.say(FeedLine{K: k, P: []int{i}, S: s})
		if f.serve || f.shot == "s" {
			m.moment(k, p)
			m.showBanner(Banner{K: k, P: ip(i), MS: 900})
		}
		m.point(p.team, p)
		return
	}
	// returned: the receiver (or the teammate who was set) plays it
	r := m.next
	if r == nil {
		r = m.team(other)[0]
	}
	m.handler = r
	if m.internal(f) {
		m.quality = 0.8
	} else {
		reach := math.Hypot(r.x-f.tx, r.y-f.ty)
		pen := 0.0
		if f.shot == "s" {
			pen = 0.25
		}
		m.quality = clamp(1-reach/160-pen, 0.15, 1)
		if m.sport == "volleyball" {
			m.touches = 0
		}
	}
	m.phase, m.pt, m.wait = "play", 0, 0.05
	if m.sport == "volleyball" {
		m.wait = 0.08
	}
}

func (m *Rally) point(team int, by *player) {
	m.score[team]++
	m.hist = append(m.hist, m.score[0]-m.score[1])
	m.streak[team]++
	m.streak[1-team] = 0
	if by != nil && m.streak[team] >= 4 && !by.fire {
		by.fire = true
		m.say(FeedLine{K: "fire", P: []int{m.idx(by)}})
		m.moment("fire", by)
	}
	if by == nil || m.streak[team] < 2 {
		for _, p := range m.team(1 - team) {
			p.fire = false
		}
	}
	if m.score[team] >= m.rules.win {
		m.finish(team, by)
		return
	}
	if m.score[team] == m.rules.win-1 && m.score[1-team] < m.rules.win-1 {
		m.showBanner(Banner{K: "matchPoint", Team: ip(team), MS: 900})
	}
	m.off = team
	m.phase, m.pt = "point", 0
}

func (m *Rally) finish(team int, by *player) {
	m.finished, m.phase, m.pt = true, "over", 0
	m.say(FeedLine{K: "win", Team: ip(team), S: m.sc()})
	mvp := by
	if mvp == nil {
		mvp = m.team(team)[0]
	}
	m.moment("win", mvp)
	m.fx("win", m.idx(mvp), 0, 0, 0)
	k := "win"
	if team == 1 {
		k = "lose"
	}
	m.showBanner(Banner{K: k, Team: ip(team), S: m.sc(), MS: 2600})
}

// Tick advances the match: dt of match time, real seconds for turn deadlines.
func (m *Rally) Tick(dt, real float64) {
	m.clock += real
	m.update(dt)
}

func (m *Rally) update(dt float64) {
	m.gameT += dt
	m.pt += dt
	base := 170.0
	if m.sport == "volleyball" {
		base = 120
	}
	for _, p := range m.P {
		sp := base * (0.75 + p.A.End/400) * (0.62 + 0.38*p.stam)
		dx, dy := p.tx-p.x, p.ty-p.y
		if d := math.Hypot(dx, dy); d > 1 {
			mv := math.Min(d, sp*dt)
			p.x += dx / d * mv
			p.y += dy / d * mv
		} else {
			p.stam = math.Min(1, p.stam+dt*0.003)
		}
	}
	switch m.phase {
	case "serve":
		s := m.handler
		m.b.x, m.b.y, m.b.z = s.x+6, s.y-2, 22+math.Abs(math.Sin(m.gameT*4))*10
		m.wait -= dt
		if m.wait <= 0 && math.Hypot(s.x-s.tx, s.y-s.ty) < 6 {
			m.quality = 1
			m.hit("p", false, true)
		}
	case "play":
		if m.aw != nil {
			if m.clock > m.aw.deadline {
				m.AITakesOver()
			}
			break
		}
		m.wait -= dt
		h := m.handler
		m.b.x, m.b.y, m.b.z = lerp(m.b.x, h.x+6, 0.4), lerp(m.b.y, h.y-2, 0.4), lerp(m.b.z, 26, 0.3)
		if m.wait <= 0 {
			m.decide()
		}
	case "flight":
		k := math.Min(1, m.pt/m.b.dur)
		m.b.x, m.b.y = lerp(m.b.fx, m.b.tx, k), lerp(m.b.fy, m.b.ty, k)
		m.b.z = lerp(26, 6, k) + math.Sin(k*math.Pi)*m.arc
		m.b.zb = 0
		if k >= 1 {
			m.land()
		}
	case "point":
		m.b.z = math.Max(0, m.b.z-dt*60)
		if m.pt > 0.9 {
			m.setupServe()
		}
	case "over":
		wt := 1
		if m.score[0] > m.score[1] {
			wt = 0
		}
		for _, p := range m.team(wt) {
			p.tx = 185 + math.Cos(m.gameT+float64(p.slot)*2)*40
			p.ty = 80 + math.Sin(m.gameT*2+float64(p.slot))*16
			if wt == 0 {
				p.ty += 220
			}
		}
		m.b.z = math.Max(0, m.b.z-dt*60)
	}
}

func (m *Rally) momentum() int {
	r := m.hist
	if len(r) > 6 {
		r = r[len(r)-6:]
	}
	return int(math.Round(clamp(50+float64(r[len(r)-1]-r[0])*10, 8, 92)))
}

// Snapshot is the state phones draw, in the same format as Match's.
func (m *Rally) Snapshot(claims map[string]string) map[string]any {
	var aw *await
	if m.aw != nil {
		aw = m.aw
	}
	return snapshot(snapIn{sport: m.sport, P: m.P, score: m.score, phase: m.phase, off: m.off, poss: m.poss, handler: m.idx(m.handler), b: m.b,
		feed: m.feed, banner: m.banner, fx: m.fxRing, claims: claims, mo: m.momentum(), aw: aw, clock: m.clock, finished: m.finished, moments: m.moments, tactics: m.tactics})
}

func (m *Rally) Finished() bool   { return m.finished }
func (m *Rally) Slow() float64    { return 1 }
func (m *Rally) awaiting() *await { return m.aw }
func (m *Rally) Results() []Result {
	return results(m.sport, m.P, m.score)
}
func (m *Rally) setHuman(f func(int) string) { m.HumanFor = f }
