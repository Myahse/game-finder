package api_test

import (
	"fmt"
	"testing"
)

func TestPlayerCard(t *testing.T) {
	e := setup(t)
	ana := e.register("ana")
	ben := e.register("ben")
	iugb := e.court("Terrain IUGB")
	_, sports := e.must(200, "", "GET", "/api/sports", nil)
	preferred := sports[0].(map[string]any)["slug"]
	var basketID string
	for _, s := range sports {
		if s.(map[string]any)["slug"] == "basketball" {
			basketID = s.(map[string]any)["id"].(string)
		}
	}

	// A new player: Elo 1000, no games → 48, bronze, on their preferred sport.
	c, _ := e.must(200, ana.Token, "GET", "/api/users/me/card", nil)
	if c["rating"] != 48.0 || c["tier"] != "bronze" || c["elo"] != 1000.0 || c["games"] != 0.0 ||
		c["sport"].(map[string]any)["slug"] != preferred || len(c["sports"].([]any)) != 0 || c["home_court"] != nil {
		t.Fatalf("fresh card = %v", c)
	}
	if c["user"].(map[string]any)["id"] != ana.ID {
		t.Fatalf("card user = %v", c["user"])
	}
	// Serial = sign-up order.
	cb, _ := e.must(200, ana.Token, "GET", "/api/users/"+ben.ID+"/card", nil)
	if cb["serial"].(float64) != c["serial"].(float64)+1 {
		t.Fatalf("serials: ana %v, ben %v", c["serial"], cb["serial"])
	}
	e.must(404, ana.Token, "GET", "/api/users/00000000-0000-0000-0000-000000000000/card", nil)

	// Ana beats 20 newcomers at basketball: her Elo passes 1200 (argent), and
	// the replay behind it announces the new tier once.
	if _, err := e.db.Pool.Exec(t.Context(), fmt.Sprintf(`
		do $$
		declare
		  v_opp uuid;
		  v_game uuid;
		  v_a uuid;
		  v_b uuid;
		begin
		  for i in 1..20 loop
		    insert into users (email, password_hash, first_name, last_name, username)
		    values ('opp' || i || '@example.com', 'x', 'Opp', 'Test', 'opp' || i) returning id into v_opp;
		    insert into games (court_id, sport_id, creator_id, start_time)
		    values ('%[1]s', '%[2]s', '%[3]s', now() - interval '10 minutes' + make_interval(secs => i)) returning id into v_game;
		    insert into game_players (game_id, user_id) values (v_game, v_opp);
		    insert into game_teams (game_id, position, name, color, score) values (v_game, 0, 'A', '#ff5a1f', 21) returning id into v_a;
		    insert into game_teams (game_id, position, name, color, score) values (v_game, 1, 'B', '#1f6fff', 10) returning id into v_b;
		    insert into game_team_players (game_id, team_id, user_id) values (v_game, v_a, '%[3]s'), (v_game, v_b, v_opp);
		    insert into game_player_stats (game_id, user_id, stats) values (v_game, '%[3]s', jsonb_build_object('points', i));
		  end loop;
		end $$`, iugb["id"], basketID, ana.ID)); err != nil {
		t.Fatal(err)
	}
	replay := func() {
		t.Helper()
		if _, err := e.db.Pool.Exec(t.Context(), `select recompute_sport_ratings($1)`, basketID); err != nil {
			t.Fatal(err)
		}
	}
	tierNotes := func() []string {
		t.Helper()
		rows, err := e.db.Pool.Query(t.Context(), `
			select title || ' | ' || body || ' | ' || (data ->> 'tier') || ' ' || (data ->> 'sport') from notifications
			where user_id = $1 and data ->> 'kind' = 'card_tier' order by created_at`, ana.ID)
		if err != nil {
			t.Fatal(err)
		}
		defer rows.Close()
		var out []string
		for rows.Next() {
			var s string
			if err := rows.Scan(&s); err != nil {
				t.Fatal(err)
			}
			out = append(out, s)
		}
		return out
	}
	replay()
	replay()
	notes := tierNotes()
	if len(notes) != 1 || notes[0] != "Your card is now SILVER | You reached the Silver tier in Basketball. Show off your new card! | argent basketball" {
		t.Fatalf("tier notifications = %q", notes)
	}

	// Default sport: the one with the most rated games.
	c, _ = e.must(200, ana.Token, "GET", "/api/users/"+ana.ID+"/card", nil)
	if c["sport"].(map[string]any)["slug"] != "basketball" || c["tier"] != "argent" || c["elo"].(float64) < 1200 ||
		c["games"] != 20.0 || c["wins"] != 20.0 || c["losses"] != 0.0 || c["win_pct"] != 100.0 || c["win_streak"] != 20.0 ||
		c["rated_games"] != 20.0 || c["elo_delta_30d"] != c["elo"].(float64)-1000 || len(c["sports"].([]any)) != 1 ||
		c["points_total"] != 210.0 || c["points_per_game"] != 10.5 || c["best_points"] != 20.0 || c["courts"] != 1.0 ||
		c["home_court"].(map[string]any)["id"] != iugb["id"] {
		t.Fatalf("card after wins = %v", c)
	}
	// 40 + (elo − 900) × 0.075 + 2 (20 games) + 2 (100%% wins) + 1 (streak ≥ 5).
	if want := float64(int(40 + (c["elo"].(float64)-900)*0.075 + 5 + 0.5)); c["rating"] != want {
		t.Fatalf("rating = %v, want %v", c["rating"], want)
	}

	// ?sport picks another sport, even one without games.
	f, _ := e.must(200, ben.Token, "GET", "/api/users/"+ana.ID+"/card?sport=football", nil)
	if f["sport"].(map[string]any)["slug"] != "football" || f["elo"] != 1000.0 || f["games"] != 0.0 ||
		f["tier"] != "bronze" || f["rating"] != 48.0 || f["home_court"] != nil {
		t.Fatalf("football card = %v", f)
	}

	// Losing the tier and getting it back does not announce it again.
	if _, err := e.db.Pool.Exec(t.Context(), `
		update game_teams set score = case position when 0 then 10 else 21 end
		where game_id = (select id from games where creator_id = $1 order by start_time desc limit 1)`, ana.ID); err != nil {
		t.Fatal(err)
	}
	replay()
	if l, _ := e.must(200, ana.Token, "GET", "/api/users/me/card", nil); l["tier"] != "bronze" {
		t.Fatalf("card after a loss = %v", l)
	}
	if _, err := e.db.Pool.Exec(t.Context(), `update game_teams set score = case position when 0 then 21 else 10 end`); err != nil {
		t.Fatal(err)
	}
	replay()
	if notes := tierNotes(); len(notes) != 1 {
		t.Fatalf("tier announced again: %q", notes)
	}

	// French players get the French text.
	for _, q := range []string{
		`update users set locale = 'fr' where id = $1`,
		`delete from player_card_tiers where user_id = $1`,
		`delete from notifications where user_id = $1`,
	} {
		if _, err := e.db.Pool.Exec(t.Context(), q, ana.ID); err != nil {
			t.Fatal(err)
		}
	}
	replay()
	if notes := tierNotes(); len(notes) != 1 || notes[0] != "Votre carte passe ARGENT | Vous atteignez le palier Argent en Basket-ball. Montrez votre nouvelle carte ! | argent basketball" {
		t.Fatalf("french tier notification = %q", notes)
	}
}
