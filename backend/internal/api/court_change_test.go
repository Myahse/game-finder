package api_test

import (
	"fmt"
	"testing"
	"time"
)

func TestCourtChanges(t *testing.T) {
	e := setup(t)
	ana := e.register("ana")
	ben := e.register("ben")
	out := e.register("outsider")
	_, sports := e.must(200, "", "GET", "/api/sports", nil)
	var basket string
	for _, s := range sports {
		if m := s.(map[string]any); m["slug"] == "basketball" {
			basket = m["id"].(string)
		}
	}
	e.onboardSport(ana, basket)
	from := e.court("Terrain IUGB")["id"].(string)
	_, courts := e.must(200, "", "GET", fmt.Sprintf("/api/courts/nearby?lat=%f&lng=%f&radius_km=50", iugbLat, iugbLng), nil)
	var to string
	for _, c := range courts {
		m := c.(map[string]any)
		for _, s := range m["sports"].([]any) {
			if s.(map[string]any)["id"] == basket && m["id"] != from && to == "" {
				to = m["id"].(string)
			}
		}
	}
	if to == "" {
		t.Skip("no second basketball court in seed data")
	}

	// Game: only the host moves it; players get an alert until they acknowledge it.
	game, _ := e.must(201, ana.Token, "POST", "/api/games", map[string]any{
		"court_id": from, "sport_id": basket, "start_time": time.Now().Add(3 * time.Hour).Format(time.RFC3339),
	})
	gid := game["id"].(string)
	e.must(200, ben.Token, "POST", "/api/games/"+gid+"/join", nil)
	e.must(403, ben.Token, "POST", "/api/games/"+gid+"/court", map[string]any{"court_id": to})
	e.must(422, ana.Token, "POST", "/api/games/"+gid+"/court", map[string]any{"court_id": from})
	moved, _ := e.must(200, ana.Token, "POST", "/api/games/"+gid+"/court", map[string]any{"court_id": to, "reason": "rain"})
	if moved["court_id"] != to {
		t.Fatalf("game court = %v", moved["court_id"])
	}
	_, alerts := e.must(200, ben.Token, "GET", "/api/me/court-changes", nil)
	if len(alerts) != 1 || alerts[0].(map[string]any)["reason"] != "rain" || alerts[0].(map[string]any)["to_court"].(map[string]any)["id"] != to {
		t.Fatalf("ben alerts = %v", alerts)
	}
	if _, mine := e.must(200, ana.Token, "GET", "/api/me/court-changes", nil); len(mine) != 0 {
		t.Fatalf("host sees own move: %v", mine)
	}
	if _, o := e.must(200, out.Token, "GET", "/api/me/court-changes", nil); len(o) != 0 {
		t.Fatalf("outsider alerts: %v", o)
	}
	e.must(204, ben.Token, "POST", "/api/me/court-changes/"+alerts[0].(map[string]any)["id"].(string)+"/seen", nil)
	if _, a := e.must(200, ben.Token, "GET", "/api/me/court-changes", nil); len(a) != 0 {
		t.Fatalf("after ack: %v", a)
	}
	nobj, _ := e.must(200, ben.Token, "GET", "/api/notifications", nil)
	notes, _ := nobj["items"].([]any)
	found := false
	for _, n := range notes {
		if m := n.(map[string]any); m["title"] == "📍 Game moved to "+moved["court"].(map[string]any)["name"].(string) {
			found = true
		}
	}
	if !found {
		t.Fatalf("no move notification: %v", notes)
	}

	// Challenge: challenger moves it before and after it's accepted; the game follows.
	c, _ := e.must(201, ana.Token, "POST", "/api/challenges", map[string]any{"opponent_id": ben.ID, "sport_id": basket, "format": "bball_1v1_11", "court_id": from})
	cid := c["id"].(string)
	e.must(403, ben.Token, "POST", "/api/challenges/"+cid+"/court", map[string]any{"court_id": to})
	mc, _ := e.must(200, ana.Token, "POST", "/api/challenges/"+cid+"/court", map[string]any{"court_id": to})
	if mc["court"].(map[string]any)["id"] != to {
		t.Fatalf("challenge court = %v", mc["court"])
	}
	_, alerts = e.must(200, ben.Token, "GET", "/api/me/court-changes", nil)
	if len(alerts) != 1 || alerts[0].(map[string]any)["challenge_id"] != cid {
		t.Fatalf("challenge alert = %v", alerts)
	}
	acc, _ := e.must(200, ben.Token, "POST", "/api/challenges/"+cid+"/accept", nil)
	e.must(200, ana.Token, "POST", "/api/challenges/"+cid+"/court", map[string]any{"court_id": from})
	g2, _ := e.must(200, ben.Token, "GET", "/api/games/"+acc["game_id"].(string), nil)
	if g2["court_id"] != from {
		t.Fatalf("challenge game court = %v", g2["court_id"])
	}
	_, alerts = e.must(200, ben.Token, "GET", "/api/me/court-changes", nil)
	if len(alerts) != 1 || alerts[0].(map[string]any)["to_court"].(map[string]any)["id"] != from {
		t.Fatalf("latest challenge alert = %v", alerts)
	}
}
