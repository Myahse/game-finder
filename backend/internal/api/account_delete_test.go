package api_test

import "testing"

func TestDeleteAccount(t *testing.T) {
	e := setup(t)

	mo := e.register("mohammed")
	bea := e.register("bea")

	// Mo organises a live game that Bea joins.
	_, sports := e.must(200, "", "GET", "/api/sports", nil)
	iugb := e.court("Terrain IUGB")
	game, _ := e.must(201, mo.Token, "POST", "/api/games", map[string]any{
		"court_id": iugb["id"], "sport_id": sports[0].(map[string]any)["id"], "max_players": 4,
		"skill_level": "intermediate", "latitude": iugbLat, "longitude": iugbLng,
	})
	gameID := game["id"].(string)
	e.must(200, bea.Token, "POST", "/api/games/"+gameID+"/join", atCourt())

	// A password account must confirm with its password.
	e.must(403, mo.Token, "DELETE", "/api/me", nil)
	e.must(403, mo.Token, "DELETE", "/api/me", map[string]string{"password": "wrong-one"})
	e.must(204, mo.Token, "DELETE", "/api/me", map[string]string{"password": "password123"})

	// The account is gone: its token stops working and it can't sign in.
	if code, _, _ := e.do(mo.Token, "GET", "/api/me", nil); code != 401 {
		t.Fatalf("GET /api/me after delete: status %d, want 401", code)
	}
	e.must(401, "", "POST", "/api/auth/login", map[string]string{"login": "mohammed", "password": "password123"})

	// The game they organised is cancelled and Bea is told.
	g, _ := e.must(200, bea.Token, "GET", "/api/games/"+gameID, nil)
	if g["status"] != "cancelled" {
		t.Fatalf("organiser's game after delete = %v", g["status"])
	}
	notes, _ := e.must(200, bea.Token, "GET", "/api/notifications", nil)
	found := false
	for _, n := range notes["items"].([]any) {
		if n.(map[string]any)["type"] == "game_cancelled" {
			found = true
		}
	}
	if !found {
		t.Fatalf("bea notifications = %v", notes)
	}

	// The username and email are free again.
	e.register("mohammed")

	// A Google-only account has no password to confirm.
	first, _ := e.must(201, "", "POST", "/api/auth/google", map[string]string{"id_token": e.google.token(t, "google-del", "awa.del@gmail.com", nil)})
	access := first["access_token"].(string)
	e.must(204, access, "DELETE", "/api/me", nil)
	if code, _, _ := e.do(access, "GET", "/api/me", nil); code != 401 {
		t.Fatalf("google account after delete: status %d, want 401", code)
	}
}
