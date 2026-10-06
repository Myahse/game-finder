package api_test

import (
	"sync"
	"testing"
	"time"
)

func TestBumpToConnect(t *testing.T) {
	e := setup(t)
	ana := e.register("ana")
	ben := e.register("ben")
	far := e.register("farah")

	// Alone: waiting.
	r, _ := e.must(200, ana.Token, "POST", "/api/me/bump", atCourt())
	if r["status"] != "waiting" {
		t.Fatalf("first bump = %v", r)
	}
	// Someone 5 km away tapping at the same time is not matched.
	r, _ = e.must(200, far.Token, "POST", "/api/me/bump", map[string]any{"latitude": iugbLat + 0.05, "longitude": iugbLng})
	if r["status"] != "waiting" {
		t.Fatalf("far bump matched: %v", r)
	}
	// Ben taps next to Ana → matched with Ana (nearest), and they're friends.
	r, _ = e.must(200, ben.Token, "POST", "/api/me/bump", map[string]any{"latitude": iugbLat + 0.0003, "longitude": iugbLng})
	if r["status"] != "matched" || r["friend"].(map[string]any)["id"] != ana.ID {
		t.Fatalf("ben bump = %v", r)
	}
	// Ana's next poll sees the match too.
	r, _ = e.must(200, ana.Token, "POST", "/api/me/bump", atCourt())
	if r["status"] != "matched" || r["friend"].(map[string]any)["id"] != ben.ID {
		t.Fatalf("ana poll = %v", r)
	}
	_, friends := e.must(200, ana.Token, "GET", "/api/me/friends", nil)
	if len(friends) != 1 {
		t.Fatalf("ana friends = %v", friends)
	}
	// Bumping again later doesn't duplicate the friendship.
	e.must(200, ana.Token, "POST", "/api/me/bump", atCourt())
	r, _ = e.must(200, ben.Token, "POST", "/api/me/bump", atCourt())
	if r["status"] != "matched" || r["already_friends"] != true {
		t.Fatalf("repeat bump = %v", r)
	}
	_, friends = e.must(200, ben.Token, "GET", "/api/me/friends", nil)
	if len(friends) != 1 {
		t.Fatalf("ben friends = %v", friends)
	}
	// Missing location is rejected; cancel clears a pending tap.
	e.must(422, far.Token, "POST", "/api/me/bump", map[string]any{})
	e.must(204, far.Token, "DELETE", "/api/me/bump", nil)

	// Two strangers tapping at the exact same moment end up as one friendship.
	cy := e.register("cyrus")
	di := e.register("dina")
	var wg sync.WaitGroup
	for i := 0; i < 3; i++ {
		for _, u := range []user{cy, di} {
			wg.Add(1)
			go func(u user) {
				defer wg.Done()
				e.do(u.Token, "POST", "/api/me/bump", atCourt())
			}(u)
		}
		wg.Wait()
	}
	var n int
	if err := e.db.Pool.QueryRow(t.Context(), `select count(*) from friend_links where
		(requester_id = $1 and addressee_id = $2) or (requester_id = $2 and addressee_id = $1)`, cy.ID, di.ID).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("concurrent bumps created %d friend rows", n)
	}
}

func TestMonthlyRecap(t *testing.T) {
	e := setup(t)
	mo := e.register("mohammed")
	bea := e.register("bea")
	iugb := e.court("Terrain IUGB")
	_, sports := e.must(200, "", "GET", "/api/sports", nil)
	sportID := sports[0].(map[string]any)["id"]

	empty, _ := e.must(200, mo.Token, "GET", "/api/me/recap", nil)
	if empty["games"] != 0.0 || empty["show_up_pct"] != nil {
		t.Fatalf("empty recap = %v", empty)
	}

	game, _ := e.must(201, mo.Token, "POST", "/api/games", map[string]any{
		"court_id": iugb["id"], "sport_id": sportID, "max_players": 4, "latitude": iugbLat, "longitude": iugbLng,
	})
	e.must(200, bea.Token, "POST", "/api/games/"+game["id"].(string)+"/join", atCourt())
	e.must(200, mo.Token, "POST", "/api/presence", map[string]any{"court_id": iugb["id"], "latitude": iugbLat, "longitude": iugbLng})
	time.Sleep(50 * time.Millisecond)

	r, _ := e.must(200, mo.Token, "GET", "/api/me/recap?month="+time.Now().UTC().Format("2006-01"), nil)
	if r["games"] != 1.0 || r["courts"] != 1.0 || r["check_ins"] != 1.0 || r["show_up_pct"] != 100.0 || r["games_created"] != 1.0 {
		t.Fatalf("recap = %v", r)
	}
	if r["top_court"].(map[string]any)["name"] != "Terrain IUGB" {
		t.Fatalf("top court = %v", r["top_court"])
	}
	mate := r["top_teammate"].(map[string]any)
	if mate["user"].(map[string]any)["id"] != bea.ID || mate["games"] != 1.0 {
		t.Fatalf("top teammate = %v", mate)
	}
	e.must(422, mo.Token, "GET", "/api/me/recap?month=oct", nil)
	e.must(401, "", "GET", "/api/me/recap", nil)
}
