package api_test

import (
	"testing"
	"time"
)

func TestChallenges(t *testing.T) {
	e := setup(t)
	ana := e.register("ana")
	ben := e.register("ben")
	cy := e.register("cyrus")
	iugb := e.court("Terrain IUGB")
	court := iugb["id"].(string)
	_, sports := e.must(200, "", "GET", "/api/sports", nil)
	var basket, tennis string
	for _, s := range sports {
		m := s.(map[string]any)
		switch m["slug"] {
		case "basketball":
			basket = m["id"].(string)
		case "tennis":
			tennis = m["id"].(string)
		}
	}
	e.onboardSport(ana, basket)
	e.onboardSport(ben, basket)

	send := func(u user, body map[string]any) (int, map[string]any) {
		code, obj, _ := e.do(u.Token, "POST", "/api/challenges", body)
		return code, obj
	}
	// Validation: format must belong to the sport; sport must be one of mine.
	if code, _ := send(ana, map[string]any{"opponent_id": ben.ID, "sport_id": basket, "format": "tennis_1set", "court_id": court}); code != 422 {
		t.Fatalf("wrong format: %d", code)
	}
	if code, _ := send(ana, map[string]any{"opponent_id": ben.ID, "sport_id": tennis, "format": "tennis_1set", "court_id": court}); code != 403 {
		t.Fatalf("wrong sport: %d", code)
	}

	// Live 1v1: Ana → Ben.
	code, ch := send(ana, map[string]any{"opponent_id": ben.ID, "sport_id": basket, "format": "bball_1v1_11", "court_id": court, "message": "To 11, winner's out"})
	if code != 201 || ch["status"] != "pending" || ch["team_size"] != 1.0 {
		t.Fatalf("create = %d %v", code, ch)
	}
	id := ch["id"].(string)
	if code, _ := send(ana, map[string]any{"opponent_id": ben.ID, "sport_id": basket, "format": "bball_1v1_21", "court_id": court}); code != 409 {
		t.Fatalf("duplicate challenge: %d", code)
	}
	list, _ := e.must(200, ben.Token, "GET", "/api/challenges", nil)
	if len(list["incoming"].([]any)) != 1 {
		t.Fatalf("ben incoming = %v", list)
	}
	// Only the opponent can accept.
	e.must(403, cy.Token, "POST", "/api/challenges/"+id+"/accept", nil)
	e.must(403, ana.Token, "POST", "/api/challenges/"+id+"/accept", nil)
	acc, _ := e.must(200, ben.Token, "POST", "/api/challenges/"+id+"/accept", nil)
	gid, _ := acc["game_id"].(string)
	if acc["status"] != "accepted" || gid == "" {
		t.Fatalf("accept = %v", acc)
	}
	game, _ := e.must(200, ana.Token, "GET", "/api/games/"+gid, nil)
	if game["player_count"] != 2.0 || game["max_players"] != 2.0 || game["game_type"] != "match" {
		t.Fatalf("challenge game = %v", game)
	}
	sb, _ := e.must(200, ana.Token, "GET", "/api/games/"+gid+"/scoreboard", nil)
	if len(sb["teams"].([]any)) != 2 {
		t.Fatalf("challenge teams = %v", sb)
	}

	// Ben reports a loss to Ana; Ben can't confirm his own report; Ana disputes, then Ana reports, Ben confirms.
	e.must(200, ben.Token, "POST", "/api/challenges/"+id+"/result", map[string]any{"winner_id": ana.ID, "score_challenger": "11", "score_opponent": "7"})
	e.must(403, ben.Token, "POST", "/api/challenges/"+id+"/confirm", nil)
	d, _ := e.must(200, ana.Token, "POST", "/api/challenges/"+id+"/dispute", nil)
	if d["status"] != "accepted" {
		t.Fatalf("dispute = %v", d)
	}
	e.must(200, ana.Token, "POST", "/api/challenges/"+id+"/result", map[string]any{"winner_id": ana.ID, "score_challenger": "11", "score_opponent": "9"})
	done, _ := e.must(200, ben.Token, "POST", "/api/challenges/"+id+"/confirm", nil)
	if done["status"] != "completed" || done["winner_id"] != ana.ID {
		t.Fatalf("confirm = %v", done)
	}
	sb, _ = e.must(200, ana.Token, "GET", "/api/games/"+gid+"/scoreboard", nil)
	teams := sb["teams"].([]any)
	if teams[0].(map[string]any)["score"] != 11.0 || teams[1].(map[string]any)["score"] != 9.0 || sb["winner_position"] != 0.0 {
		t.Fatalf("scoreboard after challenge = %v", sb)
	}
	if sb["ratings"].(map[string]any)[ana.ID].(float64) <= 1000 {
		t.Fatalf("ratings = %v", sb["ratings"])
	}
	h2h, _ := e.must(200, ana.Token, "GET", "/api/users/"+ben.ID+"/head-to-head", nil)
	if h2h["wins"] != 1.0 || h2h["losses"] != 0.0 {
		t.Fatalf("h2h = %v", h2h)
	}
	p, _ := e.must(200, ana.Token, "GET", "/api/me/progress", nil)
	if p["stats"].(map[string]any)["challenge_wins"] != 1.0 {
		t.Fatalf("progress stats = %v", p["stats"])
	}

	// Open challenge at the court, scheduled for later: anyone but the challenger can take it.
	code, open := send(ben, map[string]any{"sport_id": basket, "format": "bball_horse", "court_id": court,
		"start_time": time.Now().Add(2 * time.Hour).UTC().Format(time.RFC3339)})
	if code != 201 || open["is_open"] != true {
		t.Fatalf("open = %d %v", code, open)
	}
	_, opens := e.must(200, cy.Token, "GET", "/api/courts/"+court+"/challenges", nil)
	if len(opens) != 1 {
		t.Fatalf("open list = %v", opens)
	}
	e.must(403, cy.Token, "POST", "/api/challenges/"+open["id"].(string)+"/decline", nil)
	took, _ := e.must(200, cy.Token, "POST", "/api/challenges/"+open["id"].(string)+"/accept", nil)
	if took["opponent"].(map[string]any)["id"] != cy.ID {
		t.Fatalf("open accept = %v", took)
	}
	e.must(409, ana.Token, "POST", "/api/challenges/"+open["id"].(string)+"/accept", nil)
	// Reporting before the game starts is refused; challenger can cancel (game cancelled too).
	e.must(422, cy.Token, "POST", "/api/challenges/"+open["id"].(string)+"/result", map[string]any{"winner_id": cy.ID})
	c2, _ := e.must(200, ben.Token, "POST", "/api/challenges/"+open["id"].(string)+"/cancel", nil)
	g2, _ := e.must(200, ben.Token, "GET", "/api/games/"+c2["game_id"].(string), nil)
	if c2["status"] != "cancelled" || g2["status"] != "cancelled" {
		t.Fatalf("cancel = %v / game %v", c2, g2["status"])
	}

	// Decline, then expiry + auto-confirm via the job.
	_, dec := send(ana, map[string]any{"opponent_id": ben.ID, "sport_id": basket, "format": "bball_3pt", "court_id": court})
	r, _ := e.must(200, ben.Token, "POST", "/api/challenges/"+dec["id"].(string)+"/decline", nil)
	if r["status"] != "declined" {
		t.Fatalf("decline = %v", r)
	}
	_, old := send(ana, map[string]any{"opponent_id": ben.ID, "sport_id": basket, "format": "bball_1v1_21", "court_id": court})
	if _, err := e.db.Pool.Exec(t.Context(), `update challenges set start_time = now() - interval '1 hour' where id = $1`, old["id"]); err != nil {
		t.Fatal(err)
	}
	var out []byte
	if err := e.db.Pool.QueryRow(t.Context(), `select challenge_tick()::text`).Scan(&out); err != nil {
		t.Fatal(err)
	}
	g, _ := e.must(200, ana.Token, "GET", "/api/challenges/"+old["id"].(string), nil)
	if g["status"] != "expired" {
		t.Fatalf("expired = %v (%s)", g, out)
	}
	e.must(409, ben.Token, "POST", "/api/challenges/"+old["id"].(string)+"/accept", nil)
}

func TestPushTest(t *testing.T) {
	e := setup(t)
	u := e.register("ana")
	r, _ := e.must(200, u.Token, "POST", "/api/me/push-test", nil)
	if r["devices"] != 0.0 {
		t.Fatalf("push test = %v", r)
	}
	e.must(204, u.Token, "POST", "/api/me/push-tokens", map[string]any{"token": "web-token-1", "platform": "web"})
	r, _ = e.must(200, u.Token, "POST", "/api/me/push-test", nil)
	if r["devices"] != 1.0 {
		t.Fatalf("push test with device = %v", r)
	}
	var queued int
	if err := e.db.Pool.QueryRow(t.Context(), `select count(*) from notifications where user_id = $1 and push and type = 'system'`, u.ID).Scan(&queued); err != nil || queued != 2 {
		t.Fatalf("queued = %d %v", queued, err)
	}
}
