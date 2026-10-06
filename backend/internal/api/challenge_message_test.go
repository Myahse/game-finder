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
	cleared, _ := e.must(200, ana.Token, "PATCH", path, map[string]any{"message": " "})
	if cleared["message"] != nil {
		t.Fatalf("cleared message = %v", cleared["message"])
	}

	// Closed challenges keep their message.
	e.must(200, ana.Token, "POST", "/api/challenges/"+id+"/cancel", nil)
	e.must(409, ana.Token, "PATCH", path, map[string]any{"message": "late"})
}
