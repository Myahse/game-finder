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
	m := NewMatch(team("a", 70), team("b", 70), 7)
	play(m)
	if !m.Finished() || max(m.score[0], m.score[1]) < win || min(m.score[0], m.score[1]) >= win {
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
		m := NewMatch(team("a", 82), team("b", 55), uint64(100+i))
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
	m := NewMatch(team("a", 70), team("b", 70), 3)
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
	s := m.Snapshot(map[string]string{"1": "u1"}, 0)
	if s["v"] != 1 || len(s["pl"].([][14]int)) != 6 {
		t.Fatalf("snapshot %v", s)
	}
}
