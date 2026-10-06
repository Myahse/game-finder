package api_test

import "testing"

func TestChallengePlayers(t *testing.T) {
	e := setup(t)
	ana := e.register("ana")
	ben := e.register("ben")
	cy := e.register("cyrus")
	dee := e.register("deedee")
	eve := e.register("evelyn")
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
	add := func(u user, id, username, side string) (int, map[string]any) {
		code, obj, _ := e.do(u.Token, "POST", "/api/challenges/"+id+"/players", map[string]any{"username": username, "side": side})
		return code, obj
	}

	// 1v1: extra opponent invited; first to accept plays, the other invite closes.
	c1, _ := e.must(201, ana.Token, "POST", "/api/challenges", map[string]any{"opponent_id": ben.ID, "sport_id": basket, "format": "bball_1v1_11", "court_id": court})
	id1 := c1["id"].(string)
	if code, _ := add(ana, id1, "deedee", "challenger"); code != 409 {
		t.Fatalf("1v1 teammate: %d", code)
	}
	if code, _ := add(out, id1, "deedee", "opponent"); code != 403 {
		t.Fatalf("outsider add: %d", code)
	}
	if code, _ := add(ana, id1, "ben", "opponent"); code != 409 {
		t.Fatalf("duplicate add: %d", code)
	}
	if code, obj := add(ana, id1, "@cyrus", "opponent"); code != 200 || len(obj["players"].([]any)) != 3 {
		t.Fatalf("add cyrus: %d %v", code, obj)
	}
	inc, _ := e.must(200, cy.Token, "GET", "/api/challenges", nil)
	if len(inc["incoming"].([]any)) != 1 || inc["incoming"].([]any)[0].(map[string]any)["my_status"] != "invited" {
		t.Fatalf("cyrus incoming = %v", inc["incoming"])
	}
	acc, _ := e.must(200, cy.Token, "POST", "/api/challenges/"+id1+"/accept", nil)
	if acc["opponent"].(map[string]any)["id"] != cy.ID || acc["status"] != "accepted" {
		t.Fatalf("cyrus accept = %v", acc)
	}
	e.must(409, ben.Token, "POST", "/api/challenges/"+id1+"/accept", nil)

	// 2v2: teammates and opponents fill each side; late joiners land in the game on their team.
	c2, _ := e.must(201, ana.Token, "POST", "/api/challenges", map[string]any{"opponent_id": ben.ID, "sport_id": basket, "format": "bball_2v2", "court_id": court})
	id2 := c2["id"].(string)
	e.must(200, ana.Token, "POST", "/api/challenges/"+id2+"/players", map[string]any{"username": "deedee", "side": "challenger"})
	e.must(200, ben.Token, "POST", "/api/challenges/"+id2+"/accept", nil)
	// Ben (now in, opponent side) brings Evelyn to his side.
	e.must(200, ben.Token, "POST", "/api/challenges/"+id2+"/players", map[string]any{"username": "evelyn", "side": "opponent"})
	if code, _ := add(ben, id2, "outsider", "challenger"); code != 403 {
		t.Fatalf("ben adding to ana's side: %d", code)
	}
	e.must(200, dee.Token, "POST", "/api/challenges/"+id2+"/accept", nil)
	c2now, _ := e.must(200, eve.Token, "POST", "/api/challenges/"+id2+"/accept", nil)
	if code, _ := add(ana, id2, "outsider", "opponent"); code != 409 {
		t.Fatalf("full side add: %d", code)
	}
	gid := c2now["game_id"].(string)
	game, _ := e.must(200, ana.Token, "GET", "/api/games/"+gid, nil)
	if game["player_count"] != 4.0 {
		t.Fatalf("2v2 game players = %v", game["player_count"])
	}
	sb, _ := e.must(200, ana.Token, "GET", "/api/games/"+gid+"/scoreboard", nil)
	teams := sb["teams"].([]any)
	if len(teams[0].(map[string]any)["players"].([]any)) != 2 || len(teams[1].(map[string]any)["players"].([]any)) != 2 {
		t.Fatalf("2v2 teams = %v", teams)
	}

	// A teammate reports, someone on the other side confirms; both winners get the challenge win.
	e.must(403, out.Token, "POST", "/api/challenges/"+id2+"/result", map[string]any{"winner_id": ana.ID})
	e.must(200, dee.Token, "POST", "/api/challenges/"+id2+"/result", map[string]any{"winner_id": ana.ID, "score_challenger": "21", "score_opponent": "15"})
	e.must(403, ana.Token, "POST", "/api/challenges/"+id2+"/confirm", nil)
	done, _ := e.must(200, eve.Token, "POST", "/api/challenges/"+id2+"/confirm", nil)
	if done["status"] != "completed" {
		t.Fatalf("2v2 confirm = %v", done)
	}
	for _, u := range []user{ana, dee} {
		p, _ := e.must(200, u.Token, "GET", "/api/me/progress", nil)
		if p["stats"].(map[string]any)["challenge_wins"] != 1.0 {
			t.Fatalf("challenge_wins for %s = %v", u.ID, p["stats"])
		}
	}
	rec, _ := e.must(200, dee.Token, "GET", "/api/challenges", nil)
	if rec["record"].(map[string]any)["wins"] != 1.0 {
		t.Fatalf("dee record = %v", rec["record"])
	}
	lost, _ := e.must(200, eve.Token, "GET", "/api/challenges", nil)
	if lost["record"].(map[string]any)["losses"] != 1.0 {
		t.Fatalf("eve record = %v", lost["record"])
	}
}
