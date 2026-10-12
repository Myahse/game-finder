package jeu

import (
	"math"
	"sort"
)

// Sim is an online match the hub runs: basketball and football (Match) or a
// net sport (Rally).
type Sim interface {
	Tick(dt, real float64)
	Choose(q, i int, who string) bool
	AITakesOver()
	Finished() bool
	Slow() float64
	Snapshot(claims map[string]string) map[string]any
	Results() []Result
	awaiting() *await
	setHuman(func(idx int) string)
}

// NewSim starts the match of a sport between two teams of the same size.
func NewSim(sport string, a, b []RosterEntry, seed uint64) Sim {
	if IsNetSport(sport) {
		return NewRally(sport, a, b, seed)
	}
	return NewMatch(sport, a, b, seed)
}

// Sports Mode Jeu plays online, and the team sizes each allows.
var Sizes = map[string][]int{"basketball": {1, 2, 3}, "football": {1, 2, 3}, "volleyball": {2, 3}, "tennis": {1, 2}, "badminton": {1, 2}}

// Result is one player's line at the end of a match, for their XP and badges.
type Result struct {
	ID    string
	Won   bool
	MVP   bool
	Stats map[string]int
}

// rating is the 3–10 match rating (same formulas as the web app's rating()).
func rating(s stats, won bool, sport string) float64 {
	w := -0.2
	if won {
		w = 0.4
	}
	f := func(v int) float64 { return float64(v) }
	switch {
	case sport == "football":
		return clamp(6+f(s.pts)*0.9+f(s.ast)*0.6+f(s.stl)*0.3+f(s.blk)*0.3+f(s.reb)*0.1-f(s.to)*0.3-f(s.fga-s.fgm)*0.06+w, 3, 10)
	case IsNetSport(sport):
		return clamp(5.6+f(s.pts)*0.22+f(s.tpm)*0.25+f(s.blk)*0.3+f(s.reb)*0.05+f(s.ast)*0.04-f(s.to)*0.28+w, 3, 10)
	}
	return clamp(6+f(s.pts)*0.11+f(s.ast)*0.28+f(s.reb)*0.14+f(s.stl)*0.45+f(s.blk)*0.4-f(s.to)*0.35-f(s.fga-s.fgm)*0.07+w, 3, 10)
}

// results: who won, the MVP (best rating) and the stats the server records, in its names.
func results(sport string, P []*player, score [2]int) []Result {
	wt := 0
	if score[1] > score[0] {
		wt = 1
	}
	best, bv := -1, -1.0
	for i, p := range P {
		if r := rating(p.st, p.team == wt, sport); r > bv {
			best, bv = i, r
		}
	}
	out := make([]Result, len(P))
	for i, p := range P {
		st := map[string]int{}
		switch sport {
		case "football":
			st["goals"] = p.st.pts
		case "basketball":
			st["pts"], st["tpm"] = p.st.pts, p.st.tpm
		case "badminton":
			st["pts"], st["smashes"] = p.st.pts, p.st.tpm
		default:
			st["pts"], st["aces"] = p.st.pts, p.st.tpm
		}
		out[i] = Result{ID: p.ID, Won: p.team == wt, MVP: i == best, Stats: st}
	}
	return out
}

type snapIn struct {
	sport     string
	P         []*player
	score     [2]int
	phase     string
	off, poss int
	handler   int
	shotClock float64
	b         ball
	lane      any
	feed      []FeedLine
	banner    *Banner
	fx        [][6]any
	claims    map[string]string
	mo        int
	aw        *await
	clock     float64
	finished  bool
	moments   []Moment
	tactics   Tactics
	timeoutOK bool
}

// snapshot is the state phones draw, in the web app's Snap format (snapshot.ts).
func snapshot(in snapIn) map[string]any {
	rd := func(v float64) int { return int(math.Round(v)) }
	ro := make([][3]any, len(in.P))
	pl := make([][14]int, len(in.P))
	for i, p := range in.P {
		ro[i] = [3]any{p.ID, p.Name, p.Num}
		f := 0
		if p.fire {
			f = 1
		}
		pl[i] = [14]int{rd(p.x), rd(p.y), rd(p.stam * 100), p.st.pts, p.st.reb, p.st.ast, p.st.stl, p.st.blk, p.st.fgm, p.st.fga, f, p.st.tpm, p.st.tpa, p.st.to}
	}
	var aw any
	if in.aw != nil {
		aw = map[string]any{"k": in.aw.k, "q": in.aw.q, "who": in.aw.who, "t": int(math.Max(0, math.Ceil(in.aw.deadline-in.clock))), "o": in.aw.list}
	}
	var end any
	fin := 0
	if in.finished {
		fin = 1
		end = in.moments
	}
	keys := make([]string, 0, len(in.claims))
	for k := range in.claims {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	cl := map[string]string{}
	for _, k := range keys {
		cl[k] = in.claims[k]
	}
	return map[string]any{
		"v": 1, "g": in.sport, "ro": ro, "s": []int{in.score[0], in.score[1]}, "ph": in.phase, "off": in.off, "po": in.poss, "h": in.handler,
		"sc": rd(in.shotClock * 10), "hk": 0,
		"b": []int{rd(in.b.x), rd(in.b.y), rd(in.b.z), rd(in.b.zb)}, "bm": in.b.mode, "ps": in.lane, "pl": pl,
		"fd": in.feed, "bn": in.banner, "fx": in.fx, "cl": cl, "mo": in.mo, "aw": aw, "fin": fin, "end": end,
		"tm": map[string]any{"pace": in.tactics.Pace, "focus": in.tactics.Focus, "def": in.tactics.Def, "to": !in.timeoutOK},
	}
}
