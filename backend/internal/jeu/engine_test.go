package jeu

import "testing"

func team(prefix string, v float64) []RosterEntry {
	out := []RosterEntry{}
	for i := 0; i < 3; i++ {
		out = append(out, RosterEntry{ID: prefix + string(rune('0'+i)), Name: prefix, Num: i + 1, Big: i == 2, A: Attrs{v, v, v, v, v, v}})
	}
	return out
}

func play(m *Match) {
	for n := 0; !m.Finished() && n < 40000; n++ {
		m.Tick(0.05, 0.05)
	}
}

func TestMatchPlaysToFifteen(t *testing.T) {
	m := NewMatch("basketball", team("a", 70), team("b", 70), 7)
	play(m)
	if !m.Finished() || max(m.score[0], m.score[1]) < winB || min(m.score[0], m.score[1]) >= winB {
		t.Fatalf("score %v finished %v", m.score, m.Finished())
	}
	for tm := 0; tm < 2; tm++ {
		pts := 0
		for _, p := range m.team(tm) {
			pts += p.st.pts
		}
		if pts != m.score[tm] {
			t.Fatalf("team %d: players %d, score %d", tm, pts, m.score[tm])
		}
	}
	if m.moments[len(m.moments)-1].K != "win" {
		t.Fatalf("last moment %v", m.moments[len(m.moments)-1])
	}
}

func TestBetterTeamWinsMoreOften(t *testing.T) {
	wins := 0
	for i := 0; i < 40; i++ {
		m := NewMatch("basketball", team("a", 82), team("b", 55), uint64(100+i))
		play(m)
		if m.score[0] > m.score[1] {
			wins++
		}
	}
	if wins <= 28 {
		t.Fatalf("strong team won %d / 40", wins)
	}
}

func TestHumanTurnAndTimeout(t *testing.T) {
	m := NewMatch("basketball", team("a", 70), team("b", 70), 3)
	m.HumanFor = func(i int) string {
		if m.P[i].team == m.off {
			return "u1"
		}
		return ""
	}
	for n := 0; m.aw == nil && n < 2000; n++ {
		m.Tick(0.05, 0.05)
	}
	if m.aw == nil || m.aw.who != "u1" {
		t.Fatal("no human turn")
	}
	if m.Choose(m.aw.q, 0, "u2") {
		t.Fatal("another user chose")
	}
	if !m.Choose(m.aw.q, 0, "u1") || m.phase != "shot" {
		t.Fatalf("choice not applied, phase %s", m.phase)
	}
	// Next turn: nobody answers for 7 s, the AI plays.
	for n := 0; m.aw == nil && n < 4000; n++ {
		m.Tick(0.05, 0.05)
	}
	if m.aw == nil {
		t.Fatal("no second turn")
	}
	for n := 0; n < 150 && m.aw != nil; n++ {
		m.Tick(0.05, 0.05)
	}
	if m.aw != nil || m.feed[0].K != "aiPlays" {
		t.Fatalf("AI did not take over: %v", m.feed[0])
	}
	s := m.Snapshot(map[string]string{"1": "u1"})
	if s["v"] != 1 || len(s["pl"].([][14]int)) != 6 {
		t.Fatalf("snapshot %v", s)
	}
}

func teamN(prefix string, v float64, n int) []RosterEntry {
	return team(prefix, v)[:n]
}

func playSim(s Sim) {
	for n := 0; !s.Finished() && n < 60000; n++ {
		s.Tick(0.05, 0.05)
	}
}

func TestEverySportReachesItsScore(t *testing.T) {
	want := map[string]int{"basketball": 15, "football": 5, "volleyball": 11, "tennis": 7, "badminton": 11}
	for sport, sizes := range Sizes {
		for _, n := range sizes {
			s := NewSim(sport, teamN("a", 70, n), teamN("b", 70, n), uint64(n*31+len(sport)))
			playSim(s)
			if !s.Finished() {
				t.Fatalf("%s %dv%d did not finish", sport, n, n)
			}
			snap := s.Snapshot(nil)
			sc := snap["s"].([]int)
			if max(sc[0], sc[1]) < want[sport] || snap["g"] != sport || len(snap["ro"].([][3]any)) != 2*n {
				t.Fatalf("%s %dv%d: score %v, snap sport %v", sport, n, n, sc, snap["g"])
			}
			res := s.Results()
			mvps, winners := 0, 0
			for _, r := range res {
				if r.MVP {
					mvps++
				}
				if r.Won {
					winners++
				}
			}
			if len(res) != 2*n || mvps != 1 || winners != n {
				t.Fatalf("%s %dv%d results: %+v", sport, n, n, res)
			}
		}
	}
}

func TestFootballScoresGoals(t *testing.T) {
	m := NewMatch("football", team("a", 70), team("b", 70), 11)
	play(m)
	total := 0
	for _, p := range m.P {
		total += p.st.pts
		if p.st.tpm != 0 {
			t.Fatal("no three-pointers in football")
		}
	}
	if total != m.score[0]+m.score[1] || max(m.score[0], m.score[1]) != winF {
		t.Fatalf("goals %d, score %v", total, m.score)
	}
}

func TestRallyWaitsForAHuman(t *testing.T) {
	r := NewRally("tennis", teamN("a", 70, 1), teamN("b", 70, 1), 5)
	r.HumanFor = func(i int) string {
		if i == 0 {
			return "u1"
		}
		return ""
	}
	for n := 0; r.aw == nil && !r.Finished() && n < 20000; n++ {
		r.Tick(0.05, 0.05)
	}
	if r.aw == nil || r.aw.who != "u1" || len(r.aw.list) != 3 {
		t.Fatalf("await: %+v", r.aw)
	}
	if r.Choose(r.aw.q, 0, "u2") || !r.Choose(r.aw.q, 0, "u1") || r.phase != "flight" {
		t.Fatal("choice not applied")
	}
	// an online player who doesn't answer: the AI plays after 7 s
	for n := 0; r.aw == nil && !r.Finished() && n < 20000; n++ {
		r.Tick(0.05, 0.05)
	}
	r.Tick(0.05, 8)
	if r.aw != nil || r.feed[0].K != "aiPlays" {
		t.Fatalf("AI did not take over: %+v", r.feed)
	}
}

func TestBetterPlayersWinMoreOften(t *testing.T) {
	for _, sport := range []string{"football", "volleyball", "tennis", "badminton"} {
		wins := 0
		for i := 0; i < 40; i++ {
			s := NewSim(sport, teamN("a", 84, 2), teamN("b", 55, 2), uint64(900+i))
			playSim(s)
			if s.Results()[0].Won {
				wins++
			}
		}
		if wins <= 26 {
			t.Fatalf("%s: stronger team won only %d/40", sport, wins)
		}
	}
}
