package api_test

import (
	"testing"
	"time"
)

func TestGameScoreboardAndLeaderboard(t *testing.T) {
	e := setup(t)
	host := e.register("hosty")
	ana := e.register("ana")
	ben := e.register("ben")
	out := e.register("outsider")
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
	e.must(200, ana.Token, "POST", "/api/games/"+gid+"/join", atCourt())
	e.must(200, ben.Token, "POST", "/api/games/"+gid+"/join", atCourt())

	sb, _ := e.must(200, ana.Token, "GET", "/api/games/"+gid+"/scoreboard", nil)
	if len(sb["teams"].([]any)) != 0 || sb["stat_keys"].([]any)[0] != "points" {
		t.Fatalf("empty scoreboard = %v", sb)
	}

	board := map[string]any{
		"teams": []any{
			map[string]any{"name": "Shirts", "color": "#ff5a1f", "score": 21, "players": []string{host.ID, ana.ID}},
			map[string]any{"name": "Skins", "color": "#1f6fff", "score": 17, "players": []string{ben.ID}},
		},
		"stats": map[string]any{
			ana.ID: map[string]any{"points": 12, "assists": 4, "turnovers": 0},
			ben.ID: map[string]any{"points": 15},
		},
		"mvp_user_id": ana.ID,
	}
	// Outsiders can't edit; players can.
	e.must(403, out.Token, "PUT", "/api/games/"+gid+"/scoreboard", board)
	sb, _ = e.must(200, ana.Token, "PUT", "/api/games/"+gid+"/scoreboard", board)
	if sb["winner_position"] != 0.0 || sb["mvp_user_id"] != ana.ID || len(sb["teams"].([]any)) != 2 {
		t.Fatalf("saved scoreboard = %v", sb)
	}
	if st := sb["stats"].(map[string]any)[ana.ID].(map[string]any); st["points"] != 12.0 || st["turnovers"] != nil {
		t.Fatalf("ana stats = %v", st)
	}

	// Validation: unknown stat, non-player, same player in two teams, bad colour.
	bad := []map[string]any{
		{"stats": map[string]any{ana.ID: map[string]any{"goals": 1}}},
		{"stats": map[string]any{out.ID: map[string]any{"points": 1}}},
		{"teams": []any{
			map[string]any{"name": "A", "color": "#000000", "players": []string{ana.ID}},
			map[string]any{"name": "B", "color": "#ffffff", "players": []string{ana.ID}},
		}},
		{"teams": []any{map[string]any{"name": "A", "color": "red"}}},
		{"stats": map[string]any{ana.ID: map[string]any{"points": -3}}},
	}
	for i, b := range bad {
		if code, obj, _ := e.do(ana.Token, "PUT", "/api/games/"+gid+"/scoreboard", b); code != 422 && code != 409 {
			t.Fatalf("bad[%d]: status %d %v", i, code, obj)
		}
	}
	// A failed save leaves the previous scoreboard intact.
	sb, _ = e.must(200, ben.Token, "GET", "/api/games/"+gid+"/scoreboard", nil)
	if len(sb["teams"].([]any)) != 2 {
		t.Fatalf("scoreboard after bad saves = %v", sb)
	}

	// Future game: teams yes, scores no.
	later, _ := e.must(201, host.Token, "POST", "/api/games", map[string]any{
		"court_id": iugb["id"], "sport_id": sportID, "max_players": 6, "start_time": time.Now().Add(3 * time.Hour).UTC().Format(time.RFC3339),
	})
	lid := later["id"].(string)
	e.must(200, host.Token, "PUT", "/api/games/"+lid+"/scoreboard", map[string]any{
		"teams": []any{map[string]any{"name": "A", "color": "#000000", "players": []string{host.ID}}},
	})
	e.must(422, host.Token, "PUT", "/api/games/"+lid+"/scoreboard", map[string]any{
		"teams": []any{map[string]any{"name": "A", "color": "#000000", "score": 5}},
	})

	// Leaderboard: Ana won + MVP → first; the future game doesn't count.
	time.Sleep(20 * time.Millisecond)
	lb, _ := e.must(200, ben.Token, "GET", "/api/courts/"+iugb["id"].(string)+"/leaderboard", nil)
	players := lb["players"].([]any)
	if len(players) != 3 {
		t.Fatalf("leaderboard = %v", lb)
	}
	first := players[0].(map[string]any)
	if first["user"].(map[string]any)["id"] != ana.ID || first["wins"] != 1.0 || first["mvps"] != 1.0 || first["points"] != 12.0 || first["games"] != 1.0 {
		t.Fatalf("leaderboard #1 = %v", first)
	}
	me := lb["me"].(map[string]any)
	if me["user"].(map[string]any)["id"] != ben.ID || me["rank"] != 3.0 || me["points"] != 15.0 {
		t.Fatalf("leaderboard me = %v", me)
	}
	e.must(200, ben.Token, "GET", "/api/courts/"+iugb["id"].(string)+"/leaderboard?period=month", nil)
	e.must(422, ben.Token, "GET", "/api/courts/"+iugb["id"].(string)+"/leaderboard?period=year", nil)
}

func TestCourtWeather(t *testing.T) {
	e := setup(t)
	u := e.register("ana")
	iugb := e.court("Terrain IUGB")
	w, _ := e.must(200, u.Token, "GET", "/api/courts/"+iugb["id"].(string)+"/weather", nil)
	hours := w["hours"].([]any)
	if len(hours) != 2 {
		t.Fatalf("weather = %v", w)
	}
	h := hours[0].(map[string]any)
	if h["rain_pct"] != 80.0 || h["code"] != 63.0 || h["temp"] != 27.4 {
		t.Fatalf("hour = %v", h)
	}
	e.must(404, u.Token, "GET", "/api/courts/00000000-0000-0000-0000-000000000000/weather", nil)

	// Map rain badges: the fake forecast has rain in the current hour.
	rain, _ := e.must(200, u.Token, "GET", "/api/courts/rain?ids="+iugb["id"].(string)+",not-a-court", nil)
	c, ok := rain[iugb["id"].(string)].(map[string]any)
	if !ok || c["now"] != true || c["rain_pct"] != 80.0 || len(rain) != 1 {
		t.Fatalf("rain = %v", rain)
	}
	empty, _ := e.must(200, u.Token, "GET", "/api/courts/rain?ids=", nil)
	if len(empty) != 0 {
		t.Fatalf("empty rain = %v", empty)
	}
}
