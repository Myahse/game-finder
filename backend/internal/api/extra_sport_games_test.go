package api_test

import (
	"context"
	"testing"
	"time"
)

// Extra sports count like the main one for hosting and joining games.
func TestGamesInExtraSports(t *testing.T) {
	e := setup(t)
	ana := e.register("ana")
	ben := e.register("ben")
	_, sports := e.must(200, "", "GET", "/api/sports", nil)
	var foot string
	for _, s := range sports {
		if m := s.(map[string]any); m["slug"] == "football" {
			foot = m["id"].(string)
		}
	}
	court := e.court("Terrain IUGB")["id"].(string)
	if _, err := e.db.Pool.Exec(context.Background(), `insert into court_sports (court_id, sport_id) values ($1, $2) on conflict do nothing`, court, foot); err != nil {
		t.Fatal(err)
	}
	// Both signed up with basketball; Ana adds football as an extra sport.
	e.must(200, ana.Token, "PATCH", "/api/me", map[string]any{"extra_sport_ids": []string{foot}})

	game := map[string]any{"court_id": court, "sport_id": foot, "start_time": time.Now().Add(2 * time.Hour).Format(time.RFC3339)}
	e.must(403, ben.Token, "POST", "/api/games", game)
	g, _ := e.must(201, ana.Token, "POST", "/api/games", game)
	e.must(403, ben.Token, "POST", "/api/games/"+g["id"].(string)+"/join", nil)

	e.must(200, ben.Token, "PATCH", "/api/me", map[string]any{"extra_sport_ids": []string{foot}})
	e.must(200, ben.Token, "POST", "/api/games/"+g["id"].(string)+"/join", nil)
}
