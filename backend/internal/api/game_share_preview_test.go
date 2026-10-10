package api_test

import "testing"

// The public game link preview says how many seats are taken.
func TestGameSharePreviewSeats(t *testing.T) {
	e := setup(t)
	host := e.register("seathost")
	guest := e.register("seatguest")
	iugb := e.court("Terrain IUGB")
	_, sports := e.must(200, "", "GET", "/api/sports", nil)
	game, _ := e.must(201, host.Token, "POST", "/api/games", map[string]any{
		"court_id": iugb["id"], "sport_id": sports[0].(map[string]any)["id"],
		"latitude": iugbLat, "longitude": iugbLng, "max_players": 6,
	})
	id := game["id"].(string)
	link, _ := e.must(200, host.Token, "POST", "/api/games/"+id+"/share-link", nil)
	token := link["token"].(string)

	p, _ := e.must(200, "", "GET", "/api/game-links/"+token, nil)
	if p["max_players"] != float64(6) || p["player_count"] != float64(1) {
		t.Fatalf("preview = %v", p)
	}
	e.must(200, guest.Token, "POST", "/api/games/"+id+"/join", atCourt())
	if p, _ = e.must(200, "", "GET", "/api/game-links/"+token, nil); p["player_count"] != float64(2) {
		t.Fatalf("after join: %v", p)
	}
}
