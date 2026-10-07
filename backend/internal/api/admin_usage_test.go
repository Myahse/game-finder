package api_test

import "testing"

func TestAdminUsage(t *testing.T) {
	e := setup(t)
	admin := e.register("admin")
	host := e.register("usagehost")
	guest := e.register("usageguest")

	e.must(403, host.Token, "GET", "/api/admin/usage", nil)

	iugb := e.court("Terrain IUGB")
	_, sports := e.must(200, "", "GET", "/api/sports", nil)
	sport := sports[0].(map[string]any)
	game, _ := e.must(201, host.Token, "POST", "/api/games", map[string]any{
		"court_id": iugb["id"], "sport_id": sport["id"],
		"latitude": iugbLat, "longitude": iugbLng,
	})
	e.must(200, guest.Token, "POST", "/api/games/"+game["id"].(string)+"/join", atCourt())

	usage, _ := e.must(200, admin.Token, "GET", "/api/admin/usage?days=7", nil)
	if usage["days"] != float64(7) {
		t.Fatalf("days = %v", usage["days"])
	}
	active := usage["active"].(map[string]any)
	for _, k := range []string{"dau", "wau", "mau", "period"} {
		if active[k] != float64(2) {
			t.Fatalf("active.%s = %v, want 2 (%v)", k, active[k], active)
		}
	}
	if active["new_users"] != float64(3) || active["previous"] != float64(0) {
		t.Fatalf("active = %v", active)
	}

	features := map[string]map[string]any{}
	for _, f := range usage["features"].([]any) {
		m := f.(map[string]any)
		features[m["key"].(string)] = m
	}
	if f := features["games_created"]; f["count"] != float64(1) || f["previous"] != float64(0) {
		t.Fatalf("games_created = %v", f)
	}
	if f := features["game_joins"]; f["count"] != float64(1) {
		t.Fatalf("game_joins = %v", f)
	}
	if f := features["challenges_sent"]; f["count"] != float64(0) {
		t.Fatalf("challenges_sent = %v", f)
	}

	daily := usage["daily"].([]any)
	if len(daily) != 7 {
		t.Fatalf("daily has %d days, want 7", len(daily))
	}
	today := daily[6].(map[string]any)
	if today["active"] != float64(2) || today["games"] != float64(1) {
		t.Fatalf("today = %v", today)
	}

	top := usage["top_courts"].([]any)
	if len(top) != 1 || top[0].(map[string]any)["games"] != float64(1) || top[0].(map[string]any)["name"] != "Terrain IUGB" {
		t.Fatalf("top_courts = %v", top)
	}
	sp := usage["sports"].([]any)
	if len(sp) != 1 || sp[0].(map[string]any)["id"] != sport["id"] {
		t.Fatalf("sports = %v", sp)
	}
	if r := usage["retention"].(map[string]any); r["cohort"] != float64(0) {
		t.Fatalf("retention = %v", r)
	}

	// Out-of-range periods are clamped; the default is 30 days.
	if u, _ := e.must(200, admin.Token, "GET", "/api/admin/usage?days=9999", nil); u["days"] != float64(365) {
		t.Fatalf("clamped days = %v", u["days"])
	}
	if u, _ := e.must(200, admin.Token, "GET", "/api/admin/usage", nil); u["days"] != float64(30) || len(u["daily"].([]any)) != 30 {
		t.Fatalf("default days = %v", u["days"])
	}
}
