package api_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"

	"findthegame/backend/internal/api"
	"findthegame/backend/internal/jeu"
)

func TestGameMode(t *testing.T) {
	e := setup(t)
	ana := e.register("ana")
	ben := e.register("ben")
	cat := e.register("cat")
	iugb := e.court("Terrain IUGB")
	courtID := iugb["id"].(string)
	ctx := t.Context()

	if _, err := e.db.Pool.Exec(ctx, `insert into friend_links (requester_id, addressee_id, status) values ($1, $2, 'accepted')`, ana.ID, ben.ID); err != nil {
		t.Fatal(err)
	}

	// A fresh player gets the floor of every attribute range and no history.
	fresh, _ := e.must(200, cat.Token, "GET", "/api/jeu/me", nil)
	attrs := fresh["attributes"].(map[string]any)
	for _, k := range []string{"tir", "pen", "col", "def", "end", "men"} {
		v, ok := attrs[k].(float64)
		if !ok || v < 40 || v > 99 {
			t.Fatalf("fresh %s = %v", k, attrs[k])
		}
	}
	if len(fresh["history"].([]any)) != 0 || fresh["before"] == nil || fresh["progress"] == nil {
		t.Fatalf("fresh me = %v", fresh)
	}

	// Ana wins 8 basketball games at IUGB with real stats.
	if _, err := e.db.Pool.Exec(ctx, fmt.Sprintf(`
		do $$
		declare
		  v_sport uuid := (select id from sports where slug = 'basketball');
		  v_opp uuid;
		  v_game uuid;
		  v_a uuid;
		  v_b uuid;
		begin
		  for i in 1..8 loop
		    insert into users (email, password_hash, first_name, last_name, username)
		    values ('rival' || i || '@example.com', 'x', 'Rival', 'Test', 'rival' || i) returning id into v_opp;
		    insert into games (court_id, sport_id, creator_id, start_time)
		    values ('%[1]s', v_sport, '%[2]s', now() - interval '10 minutes' + make_interval(secs => i)) returning id into v_game;
		    insert into game_players (game_id, user_id) values (v_game, '%[2]s'), (v_game, v_opp)
		    on conflict do nothing;
		    insert into game_teams (game_id, position, name, color, score) values (v_game, 0, 'A', '#ff5a1f', 21) returning id into v_a;
		    insert into game_teams (game_id, position, name, color, score) values (v_game, 1, 'B', '#1f6fff', 12) returning id into v_b;
		    insert into game_team_players (game_id, team_id, user_id) values (v_game, v_a, '%[2]s'), (v_game, v_b, v_opp);
		    insert into game_player_stats (game_id, user_id, stats)
		    values (v_game, '%[2]s', jsonb_build_object('points', 14, 'rebounds', 5, 'assists', 4, 'steals', 2, 'blocks', 1));
		  end loop;
		  perform recompute_sport_ratings(v_sport);
		end $$`, courtID, ana.ID)); err != nil {
		t.Fatal(err)
	}

	me, _ := e.must(200, ana.Token, "GET", "/api/jeu/me", nil)
	a := me["attributes"].(map[string]any)
	if a["tir"].(float64) <= attrs["tir"].(float64) || a["def"].(float64) <= attrs["def"].(float64) {
		t.Fatalf("real games should raise attributes: %v vs fresh %v", a, attrs)
	}
	src := me["sources"].(map[string]any)
	if src["games"] != 8.0 || src["wins"] != 8.0 || src["s1"] != 14.0 || src["games_30d"] != 8.0 {
		t.Fatalf("sources = %v", src)
	}
	hist := me["history"].([]any)
	if len(hist) != 8 || hist[0].(map[string]any)["won"] != true || hist[0].(map[string]any)["xp"] != 25.0 {
		t.Fatalf("history = %v", hist)
	}
	// 30 days ago Ana had played nothing.
	if me["before"].(map[string]any)["tir"].(float64) >= a["tir"].(float64) {
		t.Fatalf("before = %v, now = %v", me["before"], a)
	}

	// Football attributes come from football games: Ana has none, so she is at the floor there.
	foot, _ := e.must(200, ana.Token, "GET", "/api/jeu/me?sport=football", nil)
	if foot["sport"] != "football" || foot["attributes"].(map[string]any)["tir"].(float64) >= a["tir"].(float64) {
		t.Fatalf("football avatar = %v", foot["attributes"])
	}

	// Simulated matches give the avatar XP, at most 200 a week, and badges.
	res, _ := e.must(200, cat.Token, "POST", "/api/jeu/results", map[string]any{"sport": "football", "won": true, "mvp": true, "stats": map[string]int{"goals": 3}})
	if res["xp"] != 35.0 || res["week"] != 35.0 || res["cap"] != 200.0 {
		t.Fatalf("first result = %v", res)
	}
	badges := fmt.Sprint(res["new_badges"])
	if !strings.Contains(badges, "first_win") || !strings.Contains(badges, "hat_trick") {
		t.Fatalf("badges = %v", res["new_badges"])
	}
	// Too soon after the previous one: nothing.
	res, _ = e.must(200, cat.Token, "POST", "/api/jeu/results", map[string]any{"sport": "football", "won": true})
	if res["xp"] != 0.0 {
		t.Fatalf("instant replay gave XP: %v", res)
	}
	e.must(422, cat.Token, "POST", "/api/jeu/results", map[string]any{"sport": "chess", "won": true})
	// The weekly cap: pretend Cat already earned 190 this week.
	if _, err := e.db.Pool.Exec(ctx, `update game_xp set at = now() - interval '1 minute', xp = 190 where user_id = $1 and raw_xp > 0`, cat.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := e.db.Pool.Exec(ctx, `update game_xp set at = now() - interval '2 minutes' where user_id = $1 and raw_xp = 0`, cat.ID); err != nil {
		t.Fatal(err)
	}
	res, _ = e.must(200, cat.Token, "POST", "/api/jeu/results", map[string]any{"sport": "tennis", "won": true})
	if res["xp"] != 10.0 || res["capped"] != true || res["week"] != 200.0 {
		t.Fatalf("capped result = %v", res)
	}
	g, _ := e.must(200, cat.Token, "GET", "/api/jeu/me", nil)
	if g["game"].(map[string]any)["week"] != 200.0 || len(g["game"].(map[string]any)["badges"].([]any)) < 3 {
		t.Fatalf("game xp = %v", g["game"])
	}

	// Ben's arena at IUGB: Ana is the player to beat there, and his friend.
	arena, _ := e.must(200, ben.Token, "GET", "/api/jeu/arenas/"+courtID, nil)
	rivals := arena["rivals"].([]any)
	if len(rivals) == 0 || rivals[0].(map[string]any)["user"].(map[string]any)["id"] != ana.ID {
		t.Fatalf("rivals = %v", rivals)
	}
	friends := arena["friends"].([]any)
	if len(friends) != 1 || friends[0].(map[string]any)["user"].(map[string]any)["id"] != ana.ID {
		t.Fatalf("friends = %v", friends)
	}
	if arena["me"].(map[string]any)["user"].(map[string]any)["id"] != ben.ID {
		t.Fatalf("arena me = %v", arena["me"])
	}
	e.must(404, ben.Token, "GET", "/api/jeu/arenas/00000000-0000-0000-0000-000000000000", nil)

	_, players := e.must(200, ben.Token, "GET", "/api/jeu/players?ids="+ana.ID+","+ben.ID+",junk", nil)
	if len(players) != 2 {
		t.Fatalf("players = %v", players)
	}

	// Ana opens an online tennis match, 1 against 1: Ben (a friend) is told, Cat is not.
	e.must(422, ana.Token, "POST", "/api/jeu/rooms", map[string]any{"court_id": courtID, "sport": "chess", "size": 1})
	e.must(422, ana.Token, "POST", "/api/jeu/rooms", map[string]any{"court_id": courtID, "sport": "tennis", "size": 3})
	e.must(404, ana.Token, "POST", "/api/jeu/rooms", map[string]any{"court_id": "00000000-0000-0000-0000-000000000000", "sport": "tennis", "size": 1})
	room, _ := e.must(201, ana.Token, "POST", "/api/jeu/rooms", map[string]any{"court_id": courtID, "sport": "tennis", "size": 1})
	code := room["code"].(string)
	if len(code) != 4 || room["host_id"] != strings.ToLower(ana.ID) || room["sport"] != "tennis" || room["size"] != 1.0 || room["filled"] != 1.0 || room["started"] != false {
		t.Fatalf("room = %v", room)
	}
	e.must(422, ana.Token, "POST", "/api/jeu/rooms", map[string]any{"court_id": "nope"})
	countNotes := func(u user) int {
		t.Helper()
		var n int
		if err := e.db.Pool.QueryRow(ctx, `select count(*) from notifications where user_id = $1 and type = 'jeu' and data ->> 'code' = $2`, u.ID, code).Scan(&n); err != nil {
			t.Fatal(err)
		}
		return n
	}
	if countNotes(ben) != 1 || countNotes(cat) != 0 {
		t.Fatalf("notifications: ben %d, cat %d", countNotes(ben), countNotes(cat))
	}
	_, rooms := e.must(200, ben.Token, "GET", "/api/jeu/rooms?court_id="+courtID, nil)
	if len(rooms) != 1 || rooms[0].(map[string]any)["code"] != code {
		t.Fatalf("rooms = %v", rooms)
	}

	// Live: Ana hosts, Ben joins, Cat watches the map.
	type sock struct {
		ws  *websocket.Conn
		evs chan map[string]any
	}
	dial := func(u user) sock {
		t.Helper()
		tb, _ := e.must(200, u.Token, "POST", "/api/me/ws-ticket", nil)
		ws, _, err := websocket.Dial(ctx, strings.Replace(e.srv.URL, "http", "ws", 1)+"/api/jeu/ws?ticket="+url.QueryEscape(tb["ticket"].(string)), nil)
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { ws.CloseNow() })
		s := sock{ws, make(chan map[string]any, 200)}
		go func() {
			for {
				_, b, err := ws.Read(ctx)
				if err != nil {
					close(s.evs)
					return
				}
				var m map[string]any
				_ = json.Unmarshal(b, &m)
				s.evs <- m
			}
		}()
		return s
	}
	send := func(s sock, v any) {
		t.Helper()
		b, _ := json.Marshal(v)
		if err := s.ws.Write(ctx, websocket.MessageText, b); err != nil {
			t.Fatal(err)
		}
	}
	wait := func(s sock, desc string, pred func(map[string]any) bool) map[string]any {
		t.Helper()
		timeout := time.After(5 * time.Second)
		for {
			select {
			case ev, ok := <-s.evs:
				if !ok {
					t.Fatalf("socket closed waiting for %s", desc)
				}
				if pred(ev) {
					return ev
				}
			case <-timeout:
				t.Fatalf("timed out waiting for %s", desc)
			}
		}
	}
	is := func(kind string) func(map[string]any) bool {
		return func(m map[string]any) bool { return m["t"] == kind }
	}

	lobbyOf := func(m map[string]any) map[string]any {
		if m["t"] == "room" {
			return m["r"].(map[string]any)
		}
		if m["t"] == "joined" {
			return m["room"].(map[string]any)
		}
		return nil
	}
	slots := func(m map[string]any) []any {
		if r := lobbyOf(m); r != nil {
			return r["slots"].([]any)
		}
		return nil
	}

	host := dial(ana)
	send(host, map[string]any{"t": "pos", "lat": 5.35, "lng": -3.99, "scene": "arena"})
	send(host, map[string]any{"t": "join", "code": code})
	if j := wait(host, "host joined", is("joined")); j["state"] != nil || j["sport"] != "tennis" || slots(j)[0] != strings.ToLower(ana.ID) || slots(j)[1] != "" {
		t.Fatalf("host joined = %v", j)
	}
	guest := dial(ben)
	wait(guest, "ana on ben's map", func(m map[string]any) bool {
		if m["t"] != "lobby" {
			return false
		}
		ps := m["players"].([]any)
		return len(ps) == 1 && ps[0].(map[string]any)["user_id"] == strings.ToLower(ana.ID) && ps[0].(map[string]any)["room"] == code
	})
	stranger := dial(cat)
	l := wait(stranger, "cat lobby", is("lobby"))
	if len(l["players"].([]any)) != 0 || len(l["rooms"].([]any)) != 1 {
		t.Fatalf("cat sees %v", l)
	}

	// Ben joins and takes the free spot (Ana's is taken).
	send(guest, map[string]any{"t": "join", "code": code})
	wait(guest, "guest joined", is("joined"))
	send(guest, map[string]any{"t": "claim", "k": "0"})
	send(guest, map[string]any{"t": "claim", "k": "1"})
	seated := func(m map[string]any) bool {
		s := slots(m)
		return s != nil && s[0] == strings.ToLower(ana.ID) && s[1] == strings.ToLower(ben.ID)
	}
	wait(host, "ben seated", seated)

	// Leaving before kick-off frees the spot.
	send(guest, map[string]any{"t": "leave"})
	wait(host, "spot freed", func(m map[string]any) bool { s := slots(m); return s != nil && s[1] == "" })
	send(guest, map[string]any{"t": "join", "code": code})
	send(guest, map[string]any{"t": "claim", "k": "1"})
	wait(host, "ben back", seated)

	// No AI: the match only starts once both are ready, after a countdown.
	send(host, map[string]any{"t": "ready", "n": 1})
	r := wait(guest, "ana ready", func(m map[string]any) bool { r := lobbyOf(m); return r != nil && len(r["ready"].([]any)) == 1 })
	if lobbyOf(r)["start_in"] != nil {
		t.Fatalf("countdown with one player ready: %v", r)
	}
	send(guest, map[string]any{"t": "ready", "n": 1})
	wait(guest, "countdown", func(m map[string]any) bool { r := lobbyOf(m); return r != nil && r["start_in"] != nil })
	st := wait(guest, "kick-off", is("state"))["s"].(map[string]any)
	ro := st["ro"].([]any)
	if st["g"] != "tennis" || len(ro) != 2 || ro[0].([]any)[1] != "Ana" || ro[1].([]any)[1] != "Ben" || st["cl"].(map[string]any)["1"] != strings.ToLower(ben.ID) {
		t.Fatalf("kick-off state = %v", st)
	}
	_, rooms = e.must(200, cat.Token, "GET", "/api/jeu/rooms", nil)
	if rooms[0].(map[string]any)["started"] != true {
		t.Fatalf("rooms = %v", rooms)
	}
	// Spots are fixed once the match is on.
	send(guest, map[string]any{"t": "claim", "k": nil})

	send(guest, map[string]any{"t": "react", "e": "<b>"})
	send(guest, map[string]any{"t": "react", "e": "fire"})
	if re := wait(host, "react", is("react")); re["e"] != "fire" || re["from"] != strings.ToLower(ben.ID) {
		t.Fatalf("react = %v", re)
	}

	// Ana leaves (phone asleep, app closed): the match keeps going for Ben.
	host.ws.CloseNow()
	wait(guest, "host gone", func(m map[string]any) bool { return m["t"] == "members" && m["host_online"] == false })
	time.Sleep(600 * time.Millisecond)
	after := wait(guest, "state", is("state"))["s"].(map[string]any)
	if after["cl"].(map[string]any)["1"] != strings.ToLower(ben.ID) {
		t.Fatalf("spots changed after kick-off: %v", after["cl"])
	}
	_, rooms = e.must(200, ben.Token, "GET", "/api/jeu/rooms", nil)
	if len(rooms) != 1 {
		t.Fatalf("match closed when the host left: %v", rooms)
	}

	// At the final whistle every player's result is recorded once (online XP, badges).
	award := api.JeuAward(e.db)
	results := []jeu.Result{{ID: ana.ID, Won: true, MVP: true, Stats: map[string]int{"pts": 7, "aces": 3}}, {ID: ben.ID, Stats: map[string]int{"pts": 4}}, {ID: "bot-1"}}
	out, err := award(ctx, "test:1", "tennis", results)
	if err != nil || len(out) != 2 {
		t.Fatalf("award = %v, %v", out, err)
	}
	var aw struct {
		XP        int      `json:"xp"`
		NewBadges []string `json:"new_badges"`
	}
	_ = json.Unmarshal(out[strings.ToLower(ana.ID)], &aw)
	if aw.XP != 50 || !slices.Contains(aw.NewBadges, "online_win") || !slices.Contains(aw.NewBadges, "ace_tennis") {
		t.Fatalf("ana award = %s", out[strings.ToLower(ana.ID)])
	}
	_ = json.Unmarshal(out[strings.ToLower(ben.ID)], &aw)
	if aw.XP != 15 {
		t.Fatalf("ben award = %s", out[strings.ToLower(ben.ID)])
	}
	again, _ := award(ctx, "test:1", "tennis", results)
	_ = json.Unmarshal(again[strings.ToLower(ana.ID)], &aw)
	if aw.XP != 0 {
		t.Fatalf("same match counted twice: %s", again[strings.ToLower(ana.ID)])
	}

	// Signed out: no live connection.
	if _, _, err := websocket.Dial(context.Background(), strings.Replace(e.srv.URL, "http", "ws", 1)+"/api/jeu/ws", nil); err == nil {
		t.Fatal("anonymous socket accepted")
	}
}
