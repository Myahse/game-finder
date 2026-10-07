package api_test

import (
	"strings"
	"testing"
)

func TestChallengeMessageEdit(t *testing.T) {
	e := setup(t)
	ana := e.register("ana")
	ben := e.register("ben")
	court := e.court("Terrain IUGB")["id"].(string)
	_, sports := e.must(200, "", "GET", "/api/sports", nil)
	var basket string
	for _, s := range sports {
		if m := s.(map[string]any); m["slug"] == "basketball" {
			basket = m["id"].(string)
		}
	}
	e.onboardSport(ana, basket)
	c, _ := e.must(201, ana.Token, "POST", "/api/challenges", map[string]any{"opponent_id": ben.ID, "sport_id": basket, "format": "bball_1v1_11", "court_id": court, "message": "Ready?"})
	id := c["id"].(string)
	path := "/api/challenges/" + id + "/message"

	// Only the challenger edits; too long is rejected; blank clears it.
	e.must(403, ben.Token, "PATCH", path, map[string]any{"message": "nope"})
	e.must(422, ana.Token, "PATCH", path, map[string]any{"message": strings.Repeat("x", 141)})
	edited, _ := e.must(200, ana.Token, "PATCH", path, map[string]any{"message": "  Bring your A game  "})
	if edited["message"] != "Bring your A game" {
		t.Fatalf("edited message = %v", edited["message"])
	}
	got, _ := e.must(200, ben.Token, "GET", "/api/challenges/"+id, nil)
	if got["message"] != "Bring your A game" {
		t.Fatalf("ben sees = %v", got["message"])
	}
	nobj, _ := e.must(200, ben.Token, "GET", "/api/notifications", nil)
	told := false
	for _, n := range nobj["items"].([]any) {
		if m := n.(map[string]any); m["title"] == "💬 @ana updated the challenge" && m["body"] == "“Bring your A game”" {
			told = true
		}
	}
	if !told {
		t.Fatalf("ben not notified of new message: %v", nobj["items"])
	}
	cleared, _ := e.must(200, ana.Token, "PATCH", path, map[string]any{"message": " "})
	if cleared["message"] != nil {
		t.Fatalf("cleared message = %v", cleared["message"])
	}

	// Closed challenges keep their message.
	e.must(200, ana.Token, "POST", "/api/challenges/"+id+"/cancel", nil)
	e.must(409, ana.Token, "PATCH", path, map[string]any{"message": "late"})
}

func TestChallengeVisibility(t *testing.T) {
	e := setup(t)
	ana := e.register("ana")
	ben := e.register("ben")
	out := e.register("outsider")
	court := e.court("Terrain IUGB")["id"].(string)
	_, sports := e.must(200, "", "GET", "/api/sports", nil)
	var basket string
	for _, s := range sports {
		if m := s.(map[string]any); m["slug"] == "basketball" {
			basket = m["id"].(string)
		}
	}
	e.onboardSport(ana, basket)

	// Private by default: only the players see it.
	c, _ := e.must(201, ana.Token, "POST", "/api/challenges", map[string]any{"opponent_id": ben.ID, "sport_id": basket, "format": "bball_1v1_11", "court_id": court})
	id := c["id"].(string)
	if c["is_public"] != false {
		t.Fatalf("default is_public = %v", c["is_public"])
	}
	e.must(404, out.Token, "GET", "/api/challenges/"+id, nil)
	vis := "/api/challenges/" + id + "/visibility"
	e.must(403, ben.Token, "PATCH", vis, map[string]any{"is_public": true})
	pub, _ := e.must(200, ana.Token, "PATCH", vis, map[string]any{"is_public": true})
	if pub["is_public"] != true {
		t.Fatalf("after public = %v", pub["is_public"])
	}
	e.must(200, out.Token, "GET", "/api/challenges/"+id, nil)
	e.must(403, out.Token, "POST", "/api/challenges/"+id+"/accept", nil) // public is view-only
	e.must(200, ana.Token, "PATCH", vis, map[string]any{"is_public": false})
	e.must(404, out.Token, "GET", "/api/challenges/"+id, nil)

	// Public from the start.
	c2, _ := e.must(201, ana.Token, "POST", "/api/challenges", map[string]any{"opponent_id": out.ID, "sport_id": basket, "format": "bball_1v1_21", "court_id": court, "is_public": true})
	if c2["is_public"] != true {
		t.Fatalf("created public = %v", c2["is_public"])
	}
	e.must(200, ben.Token, "GET", "/api/challenges/"+c2["id"].(string), nil)

	// Open challenges are always public.
	o, _ := e.must(201, ana.Token, "POST", "/api/challenges", map[string]any{"sport_id": basket, "format": "bball_3pt", "court_id": court})
	if o["is_public"] != true {
		t.Fatalf("open is_public = %v", o["is_public"])
	}
	e.must(409, ana.Token, "PATCH", "/api/challenges/"+o["id"].(string)+"/visibility", map[string]any{"is_public": false})
}
