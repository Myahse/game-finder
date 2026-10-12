package api_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
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
	if src["games"] != 8.0 || src["wins"] != 8.0 || src["ppg"] != 14.0 || src["games_30d"] != 8.0 {
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

	// Ana opens an online match: Ben (a friend) is told, Cat is not.
	room, _ := e.must(201, ana.Token, "POST", "/api/jeu/rooms", map[string]any{"court_id": courtID})
	code := room["code"].(string)
	if len(code) != 4 || room["host_id"] != strings.ToLower(ana.ID) {
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

	host := dial(ana)
	send(host, map[string]any{"t": "pos", "lat": 5.35, "lng": -3.99, "scene": "arena"})
	send(host, map[string]any{"t": "join", "code": code})
	if j := wait(host, "host joined", is("joined")); j["host"] != true {
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

	send(host, map[string]any{"t": "state", "s": map[string]any{"score": []int{2, 0}}})
	for deadline := time.Now().Add(5 * time.Second); ; {
		_, rs := e.must(200, ben.Token, "GET", "/api/jeu/rooms", nil)
		if len(rs) == 1 && rs[0].(map[string]any)["started"] == true {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("match never started: %v", rs)
		}
		time.Sleep(20 * time.Millisecond)
	}
	send(guest, map[string]any{"t": "join", "code": code})
	if j := wait(guest, "guest joined", is("joined")); j["host"] != false || j["state"].(map[string]any)["score"] == nil {
		t.Fatalf("guest joined = %v", j)
	}
	wait(host, "members", func(m map[string]any) bool { return m["t"] == "members" && len(m["members"].([]any)) == 2 })

	send(host, map[string]any{"t": "state", "s": map[string]any{"score": []int{4, 2}}})
	st := wait(guest, "state", is("state"))
	if fmt.Sprint(st["s"].(map[string]any)["score"]) != "[4 2]" {
		t.Fatalf("state = %v", st)
	}
	// Only the host can send the state.
	send(guest, map[string]any{"t": "state", "s": map[string]any{"score": []int{0, 99}}})

	send(guest, map[string]any{"t": "claim", "k": "p1"})
	if c := wait(host, "claim", is("claim")); c["from"] != strings.ToLower(ben.ID) || c["k"] != "p1" {
		t.Fatalf("claim = %v", c)
	}
	send(guest, map[string]any{"t": "intent", "q": 3, "i": 1})
	if in := wait(host, "intent", is("intent")); in["q"] != 3.0 || in["i"] != 1.0 || in["from"] != strings.ToLower(ben.ID) {
		t.Fatalf("intent = %v", in)
	}
	send(guest, map[string]any{"t": "react", "e": "<b>"})
	send(guest, map[string]any{"t": "react", "e": "fire"})
	if re := wait(host, "react", is("react")); re["e"] != "fire" || re["from"] != strings.ToLower(ben.ID) {
		t.Fatalf("react = %v", re)
	}

	// The match ends; it leaves the open list. The host leaving tells the guest.
	send(host, map[string]any{"t": "state", "s": map[string]any{"score": []int{15, 9}, "fin": 1}})
	wait(guest, "final state", func(m map[string]any) bool { return m["t"] == "state" && m["s"].(map[string]any)["fin"] == 1.0 })
	_, rooms = e.must(200, ben.Token, "GET", "/api/jeu/rooms", nil)
	if len(rooms) != 0 {
		t.Fatalf("finished match still open: %v", rooms)
	}
	send(host, map[string]any{"t": "leave"})
	wait(guest, "host left", is("host_left"))

	// Signed out: no live connection.
	if _, _, err := websocket.Dial(context.Background(), strings.Replace(e.srv.URL, "http", "ws", 1)+"/api/jeu/ws", nil); err == nil {
		t.Fatal("anonymous socket accepted")
	}
}
