package api_test

import (
	"testing"
)

func TestDailyQuests(t *testing.T) {
	e := setup(t)
	ana := e.register("ana")
	ben := e.register("ben")
	ctx := t.Context()

	q, _ := e.must(200, ana.Token, "GET", "/api/me/quests", nil)
	quests := q["quests"].([]any)
	if len(quests) != 3 {
		t.Fatalf("quests = %v", q)
	}
	ids := map[string]bool{}
	for _, x := range quests {
		m := x.(map[string]any)
		ids[m["id"].(string)] = true
		if m["done"] != false || m["claimed"] != false || m["xp"] != 20.0 {
			t.Fatalf("fresh quest = %v", m)
		}
	}
	if len(ids) != 3 {
		t.Fatalf("quests repeat: %v", quests)
	}
	st := q["streak"].(map[string]any)
	if st["current"] != 0.0 || st["today"] != false || len(q["milestones"].([]any)) != 4 {
		t.Fatalf("fresh streak = %v / %v", st, q["milestones"])
	}
	// Mode Jeu on: the third quest is a Mode Jeu one.
	qj, _ := e.must(200, ana.Token, "GET", "/api/me/quests?jeu=1", nil)
	third := qj["quests"].([]any)[2].(map[string]any)["id"].(string)
	if third != "jeu_play" && third != "jeu_win" && third != "jeu_online" {
		t.Fatalf("Mode Jeu quest = %s", third)
	}

	// Nothing is done: nothing can be claimed.
	first := quests[0].(map[string]any)["id"].(string)
	e.must(422, ana.Token, "POST", "/api/me/quests/"+first+"/claim", nil)
	e.must(422, ana.Token, "POST", "/api/me/quests/all/claim", nil)
	e.must(422, ana.Token, "POST", "/api/me/quests/bogus/claim", nil)

	// Do every quest of the day directly in the database, then claim them.
	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := e.db.Pool.Exec(ctx, sql, args...); err != nil {
			t.Fatal(err)
		}
	}
	e.must(200, ana.Token, "POST", "/api/me/friend-requests", map[string]any{"username": "ben"}) // friend
	court := e.court("Terrain IUGB")
	exec(`insert into court_presence (user_id, court_id, expires_at) values ($1, $2, now() + interval '1 hour')`, ana.ID, court["id"])
	exec(`alter table games disable trigger user`)
	exec(`insert into games (court_id, sport_id, creator_id, start_time) select $1, id, $2, now() - interval '10 minutes' from sports where slug = 'basketball'`, court["id"], ben.ID)
	exec(`insert into games (court_id, sport_id, creator_id, start_time) select $1, id, $2, now() + interval '2 hours' from sports where slug = 'basketball'`, court["id"], ana.ID)
	exec(`alter table games enable trigger user`)
	exec(`insert into game_players (game_id, user_id) select id, $1 from games where creator_id = $2 on conflict do nothing`, ana.ID, ben.ID)
	exec(`insert into challenges (sport_id, format, team_size, challenger_id, court_id, start_time) select id, '1v1', 1, $1, $2, now() + interval '1 day' from sports where slug = 'basketball'`, ana.ID, court["id"])

	q, _ = e.must(200, ana.Token, "GET", "/api/me/quests", nil)
	for _, x := range q["quests"].([]any) {
		if m := x.(map[string]any); m["done"] != true {
			t.Fatalf("quest not done: %v", m)
		}
	}
	before, _ := e.must(200, ana.Token, "GET", "/api/me/progress", nil)
	total := 0.0
	for _, x := range q["quests"].([]any) {
		c, _ := e.must(200, ana.Token, "POST", "/api/me/quests/"+x.(map[string]any)["id"].(string)+"/claim", nil)
		total += c["gained"].(float64)
	}
	c, _ := e.must(200, ana.Token, "POST", "/api/me/quests/all/claim", nil)
	total += c["gained"].(float64)
	if total != 90 || c["today_xp"] != 90.0 || c["all"].(map[string]any)["claimed"] != true {
		t.Fatalf("claimed %v: %v", total, c)
	}
	again, _ := e.must(200, ana.Token, "POST", "/api/me/quests/all/claim", nil)
	if again["gained"] != 0.0 {
		t.Fatalf("claimed twice: %v", again)
	}
	if s := c["streak"].(map[string]any); s["current"] != 1.0 || s["today"] != true {
		t.Fatalf("streak after a day = %v", s)
	}
	// Quest XP is in the level: without the claims, the level XP drops by exactly 90.
	with, _ := e.must(200, ana.Token, "GET", "/api/me/progress", nil)
	var without float64
	if err := e.db.Pool.QueryRow(ctx, `select (player_progress($1) ->> 'xp')::float - (select sum(xp) from quest_claims where user_id = $1)`, ana.ID).Scan(&without); err != nil {
		t.Fatal(err)
	}
	if with["xp"].(float64)-without != 90 || with["xp"].(float64) < before["xp"].(float64)+90 {
		t.Fatalf("level XP %v → %v (without quests %v)", before["xp"], with["xp"], without)
	}

	// Two days already claimed before today: today's first claim is day 3 of the streak (+30).
	exec(`insert into quest_claims (user_id, day, quest, xp) values ($1, quest_today() - 1, 'checkin', 20), ($1, quest_today() - 2, 'checkin', 20)`, ben.ID)
	exec(`insert into court_presence (user_id, court_id, expires_at) values ($1, $2, now() + interval '1 hour')`, ben.ID, court["id"])
	exec(`insert into games (court_id, sport_id, creator_id, start_time) select $1, id, $2, now() + interval '3 hours' from sports where slug = 'basketball'`, court["id"], ben.ID)
	// whatever Ben's 3 quests are today, he did them all
	exec(`insert into game_players (game_id, user_id) select id, $1 from games where creator_id in ($1, $2) on conflict do nothing`, ben.ID, ana.ID)
	exec(`update friend_links set status = 'accepted', responded_at = now() where addressee_id = $1`, ben.ID)
	exec(`insert into challenges (sport_id, format, team_size, challenger_id, court_id, start_time) select id, '1v1', 1, $1, $2, now() + interval '1 day' from sports where slug = 'basketball'`, ben.ID, court["id"])
	qb0, _ := e.must(200, ben.Token, "GET", "/api/me/quests", nil)
	for _, x := range qb0["quests"].([]any) {
		if m := x.(map[string]any); m["done"] != true {
			t.Fatalf("ben's quest not done: %v", m)
		}
	}
	qb, _ := e.must(200, ben.Token, "GET", "/api/me/quests", nil)
	var doneID string
	for _, x := range qb["quests"].([]any) {
		if m := x.(map[string]any); m["done"] == true {
			doneID = m["id"].(string)
			break
		}
	}
	if doneID == "" {
		t.Fatalf("ben has nothing done: %v", qb)
	}
	cb, _ := e.must(200, ben.Token, "POST", "/api/me/quests/"+doneID+"/claim", nil)
	if cb["gained"] != 50.0 || cb["bonus"] != 30.0 || cb["streak"].(map[string]any)["current"] != 3.0 {
		t.Fatalf("streak day 3 = %v", cb)
	}

	// The evening reminder: a 2-day streak with nothing claimed yet today.
	cy := e.register("cyrus")
	exec(`insert into quest_claims (user_id, day, quest, xp) values ($1, quest_today() - 1, 'checkin', 20), ($1, quest_today() - 2, 'checkin', 20)`, cy.ID)
	var out string
	if err := e.db.Pool.QueryRow(ctx, `select quest_tick()::text`).Scan(&out); err != nil {
		t.Fatal(err)
	}
	var n int
	if err := e.db.Pool.QueryRow(ctx, `select count(*) from notifications where user_id = $1 and data ->> 'kind' = 'quest'`, cy.ID).Scan(&n); err != nil {
		t.Fatal(err)
	}
	var hour int
	_ = e.db.Pool.QueryRow(ctx, `select extract(hour from now() at time zone 'UTC')::int`).Scan(&hour)
	if (hour >= 17) != (n == 1) {
		t.Fatalf("reminders at %dh: %d (%s)", hour, n, out)
	}
}
