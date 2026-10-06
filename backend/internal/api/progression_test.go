package api_test

import (
	"encoding/json"
	"testing"
)

func TestPlayerProgression(t *testing.T) {
	e := setup(t)
	host := e.register("hosty")
	ana := e.register("ana")
	ben := e.register("ben")
	cy := e.register("cyrus")
	iugb := e.court("Terrain IUGB")
	_, sports := e.must(200, "", "GET", "/api/sports", nil)
	var sportID any
	for _, s := range sports {
		if s.(map[string]any)["slug"] == "basketball" {
			sportID = s.(map[string]any)["id"]
		}
	}
	game, _ := e.must(201, host.Token, "POST", "/api/games", map[string]any{
		"court_id": iugb["id"], "sport_id": sportID, "max_players": 6, "latitude": iugbLat, "longitude": iugbLng,
	})
	gid := game["id"].(string)
	for _, u := range []user{ana, ben, cy} {
		e.must(200, u.Token, "POST", "/api/games/"+gid+"/join", atCourt())
	}

	// Fresh player: level 1, nothing earned yet.
	p, _ := e.must(200, cy.Token, "GET", "/api/me/progress", nil)
	if p["level"] != 1.0 || len(p["ratings"].([]any)) != 0 {
		t.Fatalf("fresh progress = %v", p)
	}

	board := map[string]any{
		"teams": []any{
			map[string]any{"name": "A", "color": "#ff5a1f", "score": 21, "players": []string{host.ID, ana.ID}},
			map[string]any{"name": "B", "color": "#1f6fff", "score": 15, "players": []string{ben.ID, cy.ID}},
		},
		"stats":       map[string]any{ana.ID: map[string]any{"points": 14}},
		"mvp_user_id": ana.ID,
	}
	sb, _ := e.must(200, host.Token, "PUT", "/api/games/"+gid+"/scoreboard", board)
	ratings := sb["ratings"].(map[string]any)
	if ratings[ana.ID].(float64) <= 1000 || ratings[ben.ID].(float64) >= 1000 {
		t.Fatalf("ratings after win = %v", ratings)
	}
	// Re-saving the same result replays to the same ratings.
	sb2, _ := e.must(200, host.Token, "PUT", "/api/games/"+gid+"/scoreboard", board)
	if sb2["ratings"].(map[string]any)[ana.ID] != ratings[ana.ID] {
		t.Fatalf("ratings drifted: %v vs %v", sb2["ratings"], ratings)
	}

	p, _ = e.must(200, ana.Token, "GET", "/api/me/progress", nil)
	stats := p["stats"].(map[string]any)
	if stats["games"] != 1.0 || stats["wins"] != 1.0 || stats["mvps"] != 1.0 || stats["rain"] != 1.0 {
		t.Fatalf("ana stats = %v", stats)
	}
	earned := map[string]bool{}
	for _, b := range p["badges"].([]any) {
		bm := b.(map[string]any)
		if bm["earned_at"] != nil {
			earned[bm["id"].(string)] = true
		}
	}
	for _, id := range []string{"first_game", "first_win", "first_mvp", "rain_player"} {
		if !earned[id] {
			t.Fatalf("missing badge %s in %v", id, p["badges"])
		}
	}
	if earned["games_10"] || p["xp"].(float64) < 50 || p["level"].(float64) < 1 {
		t.Fatalf("progress = %v", p)
	}
	if st := p["streak"].(map[string]any); st["current"] != 1.0 || st["active_this_week"] != true {
		t.Fatalf("streak = %v", st)
	}
	r := p["ratings"].([]any)[0].(map[string]any)
	if r["rating"].(float64) <= 1000 || r["games"] != 1.0 {
		t.Fatalf("rating = %v", r)
	}
	// Badges were awarded with the scoreboard save, with a notification.
	nobj, notes := e.must(200, ana.Token, "GET", "/api/notifications", nil)
	if items, ok := nobj["items"].([]any); ok {
		notes = items
	}
	found := false
	for _, n := range notes {
		if n.(map[string]any)["type"] == "achievement" {
			found = true
		}
	}
	if !found {
		t.Fatalf("no achievement notification: %v", notes)
	}

	// Public progress of another player.
	other, _ := e.must(200, ben.Token, "GET", "/api/users/"+ana.ID+"/progress", nil)
	if other["xp"] != p["xp"] || other["new_badges"] != nil {
		t.Fatalf("public progress = %v", other)
	}

	// King of the Court: last week's #1 gets the crown this week.
	if _, err := e.db.Pool.Exec(t.Context(), `update games set start_time = start_time - interval '7 days' where id = $1`, gid); err != nil {
		t.Fatal(err)
	}
	var out []byte
	if err := e.db.Pool.QueryRow(t.Context(), `select progress_tick()::text`).Scan(&out); err != nil {
		t.Fatal(err)
	}
	_, kings := e.must(200, ben.Token, "GET", "/api/kings", nil)
	if len(kings) != 1 || kings[0].(map[string]any)["user_id"] != ana.ID {
		t.Fatalf("kings = %v (tick %s)", kings, out)
	}
	if err := e.db.Pool.QueryRow(t.Context(), `select progress_tick()::text`).Scan(&out); err != nil {
		t.Fatal(err)
	}
	var tick struct{ Kings int }
	if err := json.Unmarshal(out, &tick); err != nil || tick.Kings != 0 {
		t.Fatalf("second tick crowned again: %s", out)
	}
	p, _ = e.must(200, ana.Token, "GET", "/api/me/progress", nil)
	if len(p["crowns"].([]any)) != 1 {
		t.Fatalf("crowns = %v", p["crowns"])
	}
	nb := p["new_badges"].([]any)
	if len(nb) != 1 || nb[0] != "king" {
		t.Fatalf("new badges = %v", nb)
	}
}
