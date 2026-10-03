package api_test

// End-to-end tests against a real PostgreSQL. Set TEST_DATABASE_URL to a
// database the test may drop and recreate the public schema in, e.g.
//   TEST_DATABASE_URL=postgres://postgres@localhost:5432/ftg_test?sslmode=disable go test ./...

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"

	"findthegame/backend/internal/api"
	"findthegame/backend/internal/config"
	"findthegame/backend/internal/db"
	"findthegame/backend/internal/jobs"
	"findthegame/backend/internal/realtime"
	"findthegame/backend/internal/storage"
	"findthegame/backend/migrations"
	"findthegame/backend/seed"
)

type env struct {
	t      *testing.T
	srv    *httptest.Server
	db     *db.DB
	google *fakeGoogle
}

func setup(t *testing.T) *env {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	d, err := db.Connect(context.Background(), url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(d.Close)
	// Registered after d.Close so it runs first (cleanups are LIFO).
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	if _, err := d.Pool.Exec(ctx, `drop schema public cascade; create schema public;
		drop table if exists schema_migrations;`); err != nil {
		t.Fatal(err)
	}
	if err := d.Migrate(ctx, migrations.FS); err != nil {
		t.Fatal(err)
	}
	if _, err := d.Pool.Exec(ctx, seed.TestFixtures); err != nil {
		t.Fatal(err)
	}
	if _, err := d.Pool.Exec(ctx, `
		update courts set photos = array['http://test/place.jpg']::text[]
		where coalesce(array_length(photos, 1), 0) = 0`); err != nil {
		t.Fatal(err)
	}

	google := newFakeGoogle(t)
	cfg := config.Config{
		GoogleClientIDs: []string{fakeGoogleClientID},
		GoogleJWKSURL:   google.jwks.URL,
		JWTSecret:       []byte(strings.Repeat("s", 32)),
		AccessTokenTTL:  time.Hour,
		RefreshTokenTTL: time.Hour,
		CORSOrigins:     []string{"*"},
		AdminEmails:     []string{"admin@example.com"},
		UploadDir:       t.TempDir(),
		PublicBaseURL:   "http://test",
		MaxUploadBytes:  1 << 20,
	}
	hub := realtime.NewHub()
	go hub.Listen(ctx, d.Pool)
	media, err := storage.NewMedia(cfg)
	if err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewServer(api.New(cfg, d, hub, media).Routes())
	t.Cleanup(srv.Close)
	time.Sleep(100 * time.Millisecond) // let LISTEN attach
	return &env{t: t, srv: srv, db: d, google: google}
}

type user struct {
	ID    string
	Token string
}

func (e *env) do(token, method, path string, body any) (int, map[string]any, []any) {
	e.t.Helper()
	var rd *bytes.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		rd = bytes.NewReader(b)
	} else {
		rd = bytes.NewReader(nil)
	}
	req, _ := http.NewRequest(method, e.srv.URL+path, rd)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		e.t.Fatal(err)
	}
	defer resp.Body.Close()
	var raw any
	_ = json.NewDecoder(resp.Body).Decode(&raw)
	obj, _ := raw.(map[string]any)
	arr, _ := raw.([]any)
	return resp.StatusCode, obj, arr
}

func (e *env) must(want int, token, method, path string, body any) (map[string]any, []any) {
	e.t.Helper()
	got, obj, arr := e.do(token, method, path, body)
	if got != want {
		e.t.Fatalf("%s %s: status %d, want %d: %v", method, path, got, want, obj)
	}
	return obj, arr
}

func (e *env) register(username string) user {
	e.t.Helper()
	email := username + "@example.com"
	obj, _ := e.must(201, "", "POST", "/api/auth/register", map[string]string{
		"first_name": strings.ToUpper(username[:1]) + username[1:], "last_name": "Test",
		"username": username, "email": email, "password": "password123",
	})
	u := obj["user"].(map[string]any)
	out := user{ID: u["id"].(string), Token: obj["access_token"].(string)}
	e.onboardSport(out, "")
	return out
}

func (e *env) onboardSport(u user, sportID string) {
	e.t.Helper()
	if sportID == "" {
		_, sports := e.must(200, "", "GET", "/api/sports", nil)
		sportID = sports[0].(map[string]any)["id"].(string)
	}
	e.must(200, u.Token, "PATCH", "/api/me", map[string]any{
		"preferred_sport_id": sportID,
		"skill_level":        "intermediate",
		"onboarded":          true,
	})
}

const iugbLat, iugbLng = 5.2133, -3.7389

func atCourt() map[string]any {
	return map[string]any{"latitude": iugbLat, "longitude": iugbLng}
}

func (e *env) court(name string) map[string]any {
	e.t.Helper()
	_, arr := e.must(200, "", "GET", fmt.Sprintf("/api/courts/nearby?lat=%f&lng=%f&radius_km=50", iugbLat, iugbLng), nil)
	for _, c := range arr {
		if c.(map[string]any)["name"] == name {
			return c.(map[string]any)
		}
	}
	e.t.Fatalf("court %q not found", name)
	return nil
}

func TestCoreFlow(t *testing.T) {
	e := setup(t)
	ctx := context.Background()

	mo := e.register("mohammed")
	bea := e.register("bea")
	cal := e.register("cal")

	// Duplicate username / email are rejected.
	e.must(409, "", "POST", "/api/auth/register", map[string]string{
		"first_name": "X", "last_name": "Y", "username": "Mohammed", "email": "other@example.com", "password": "password123",
	})
	// Login + refresh rotation.
	login, _ := e.must(200, "", "POST", "/api/auth/login", map[string]string{"email": "bea@example.com", "password": "password123"})
	e.must(200, "", "POST", "/api/auth/login", map[string]string{"login": "bea", "password": "password123"})
	e.must(401, "", "POST", "/api/auth/login", map[string]string{"email": "bea@example.com", "password": "nope-nope"})
	rt := login["refresh_token"].(string)
	e.must(200, "", "POST", "/api/auth/refresh", map[string]string{"refresh_token": rt})
	e.must(401, "", "POST", "/api/auth/refresh", map[string]string{"refresh_token": rt}) // single use

	// Onboarding: preferred sport.
	_, sports := e.must(200, "", "GET", "/api/sports", nil)
	basketball := sports[0].(map[string]any)
	if basketball["slug"] != "basketball" {
		t.Fatalf("first sport = %v", basketball["slug"])
	}
	me, _ := e.must(200, mo.Token, "PATCH", "/api/me", map[string]any{
		"preferred_sport_id": basketball["id"], "skill_level": "intermediate", "onboarded": true,
	})
	if me["onboarded"] != true || me["email"] != "mohammed@example.com" {
		t.Fatalf("me = %v", me)
	}

	// Map: courts visible, nearest first, inactive.
	iugb := e.court("Terrain IUGB")
	if iugb["activity"] != "inactive" {
		t.Fatalf("activity = %v", iugb["activity"])
	}

	// Realtime: Bea watches the socket.
	ticketBody, _ := e.must(200, bea.Token, "POST", "/api/me/ws-ticket", nil)
	ws, _, err := websocket.Dial(ctx, strings.Replace(e.srv.URL, "http", "ws", 1)+"/api/ws?ticket="+ticketBody["ticket"].(string), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer ws.CloseNow()
	events := make(chan map[string]any, 100)
	go func() {
		for {
			_, b, err := ws.Read(ctx)
			if err != nil {
				close(events)
				return
			}
			var m map[string]any
			_ = json.Unmarshal(b, &m)
			events <- m
		}
	}()
	waitFor := func(desc string, pred func(map[string]any) bool) map[string]any {
		t.Helper()
		timeout := time.After(3 * time.Second)
		for {
			select {
			case ev, ok := <-events:
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

	// Create a game starting now with 3 spots.
	game, _ := e.must(201, mo.Token, "POST", "/api/games", map[string]any{
		"court_id": iugb["id"], "sport_id": basketball["id"], "max_players": 3, "skill_level": "intermediate",
		"latitude": iugbLat, "longitude": iugbLng,
	})
	gameID := game["id"].(string)
	if game["status"] != "active" || game["player_count"].(float64) != 1 || game["joined"] != true {
		t.Fatalf("created game = %v", game)
	}
	waitFor("court active", func(ev map[string]any) bool {
		return ev["type"] == "court_stats" && ev["court_id"] == iugb["id"] && ev["activity"] == "active"
	})

	// Join updates count in realtime; duplicates and over-capacity are refused.
	e.must(200, bea.Token, "POST", "/api/games/"+gameID+"/join", atCourt())
	waitFor("2 players", func(ev map[string]any) bool {
		return ev["type"] == "game" && ev["game_id"] == gameID && ev["player_count"] == 2.0
	})
	_, body, _ := e.do(bea.Token, "POST", "/api/games/"+gameID+"/join", nil)
	if body["error"] != "already_joined" {
		t.Fatalf("duplicate join: %v", body)
	}
	e.must(200, cal.Token, "POST", "/api/games/"+gameID+"/join", atCourt())
	far := e.register("farplayer")
	_, body, _ = e.do(far.Token, "POST", "/api/games/"+gameID+"/join", map[string]any{"latitude": 0.0, "longitude": 0.0})
	if body["error"] != "too_far_from_court" {
		t.Fatalf("far join active game: %v", body)
	}
	extra := e.register("dan")
	_, body, _ = e.do(extra.Token, "POST", "/api/games/"+gameID+"/join", atCourt())
	if body["error"] != "game_full" {
		t.Fatalf("full game join: %v", body)
	}

	// Leave frees a spot.
	g, _ := e.must(200, cal.Token, "POST", "/api/games/"+gameID+"/leave", nil)
	if g["player_count"].(float64) != 2 || g["joined"] != false {
		t.Fatalf("after leave: %v", g)
	}
	waitFor("back to 2", func(ev map[string]any) bool {
		return ev["type"] == "game" && ev["game_id"] == gameID && ev["player_count"] == 2.0
	})

	// "I want to play" list.
	_, list := e.must(200, extra.Token, "GET", fmt.Sprintf("/api/games/nearby?lat=%f&lng=%f", iugbLat, iugbLng), nil)
	if len(list) != 1 || list[0].(map[string]any)["spots_left"].(float64) != 1 {
		t.Fatalf("nearby games = %v", list)
	}

	// Presence: too far, then at the court.
	cocody := e.court("Terrain Cocody")
	_, body, _ = e.do(cal.Token, "POST", "/api/presence", map[string]any{
		"court_id": cocody["id"], "latitude": iugbLat, "longitude": iugbLng,
	})
	if body["error"] != "too_far_from_court" {
		t.Fatalf("far presence: %v", body)
	}
	p, _ := e.must(200, cal.Token, "POST", "/api/presence", map[string]any{
		"court_id": cocody["id"], "latitude": cocody["latitude"], "longitude": cocody["longitude"],
	})
	exp, _ := time.Parse(time.RFC3339Nano, p["expires_at"].(string))
	if d := time.Until(exp); d < 29*time.Minute || d > 31*time.Minute {
		t.Fatalf("presence expires in %v", d)
	}
	ev := waitFor("cocody players", func(ev map[string]any) bool {
		return ev["type"] == "court_stats" && ev["court_id"] == cocody["id"]
	})
	if ev["activity"] != "players" || ev["player_count"] != 1.0 {
		t.Fatalf("cocody stats: %v", ev)
	}

	// Privacy: other users see the aggregate only.
	detail, _ := e.must(200, bea.Token, "GET", "/api/courts/"+cocody["id"].(string), nil)
	if detail["player_count"].(float64) != 1 || detail["my_presence"] != nil {
		t.Fatalf("court detail for other user: %v", detail)
	}
	raw, _ := json.Marshal(detail)
	if strings.Contains(string(raw), "cal") {
		t.Fatalf("court detail leaks the present user: %s", raw)
	}
	other, _ := e.must(200, bea.Token, "GET", "/api/me/presence", nil)
	if other != nil {
		t.Fatalf("bea sees presence: %v", other)
	}

	// Expiry: warning first, then automatic deactivation.
	if _, err := e.db.Pool.Exec(ctx, "update court_presence set expires_at = now() + interval '2 minutes'"); err != nil {
		t.Fatal(err)
	}
	jobs.RunOnce(ctx, e.db, nil)
	notes, _ := e.must(200, cal.Token, "GET", "/api/notifications", nil)
	items := notes["items"].([]any)
	if len(items) != 1 || items[0].(map[string]any)["type"] != "presence_check" {
		t.Fatalf("notifications = %v", notes)
	}
	e.must(200, cal.Token, "POST", "/api/presence/confirm", nil) // YES, I'M STILL HERE
	if _, err := e.db.Pool.Exec(ctx, "update court_presence set expires_at = now() - interval '1 second'"); err != nil {
		t.Fatal(err)
	}
	jobs.RunOnce(ctx, e.db, nil)
	waitFor("cocody inactive", func(ev map[string]any) bool {
		return ev["type"] == "court_stats" && ev["court_id"] == cocody["id"] && ev["activity"] == "inactive"
	})
	mine, _ := e.must(200, cal.Token, "GET", "/api/me/presence", nil)
	if mine != nil {
		t.Fatalf("presence still active: %v", mine)
	}

	// Creator edits, then cancels; players are notified in realtime.
	e.must(200, mo.Token, "PATCH", "/api/games/"+gameID, map[string]any{"max_players": 10})
	_, body, _ = e.do(bea.Token, "PATCH", "/api/games/"+gameID, map[string]any{"max_players": 4})
	if body["error"] != "not_found" {
		t.Fatalf("non-creator update: %v", body)
	}
	e.must(200, mo.Token, "POST", "/api/games/"+gameID+"/cancel", map[string]string{"reason": "rain"})
	waitFor("cancel notification", func(ev map[string]any) bool {
		return ev["type"] == "notification" && ev["notification_type"] == "game_cancelled"
	})
	_, body, _ = e.do(extra.Token, "POST", "/api/games/"+gameID+"/join", nil)
	if body["error"] != "game_closed" {
		t.Fatalf("join cancelled: %v", body)
	}

	// Profile stats.
	prof, _ := e.must(200, bea.Token, "GET", "/api/users/"+mo.ID, nil)
	if prof["stats"].(map[string]any)["games_created"].(float64) != 0 { // cancelled games don't count
		t.Fatalf("stats = %v", prof["stats"])
	}
	if _, ok := prof["email"]; ok {
		t.Fatalf("public profile leaks email: %v", prof)
	}
}

func TestCourtProposalAndAdmin(t *testing.T) {
	e := setup(t)
	admin := e.register("admin")
	u := e.register("player1")
	_, sports := e.must(200, "", "GET", "/api/sports", nil)
	bb := sports[0].(map[string]any)["id"]

	// Non-admins can't use admin routes.
	e.must(403, u.Token, "GET", "/api/admin/stats", nil)

	court, _ := e.must(201, u.Token, "POST", "/api/courts", map[string]any{
		"name": "New Court", "latitude": 5.22, "longitude": -3.74, "sport_ids": []any{bb},
	})
	if court["status"] != "pending" {
		t.Fatalf("proposal status = %v", court["status"])
	}
	// Pending courts stay off the public map until approved; rejected courts stay hidden.
	onMap := func(id any) map[string]any {
		t.Helper()
		_, arr := e.must(200, "", "GET", "/api/courts/nearby?lat=5.22&lng=-3.74&radius_km=1", nil)
		for _, c := range arr {
			if c.(map[string]any)["id"] == id {
				return c.(map[string]any)
			}
		}
		return nil
	}
	if c := onMap(court["id"]); c != nil {
		t.Fatalf("pending court on public map = %v", c)
	}
	onMapAuth := func(token string, id any) map[string]any {
		t.Helper()
		_, arr := e.must(200, token, "GET", "/api/courts/nearby?lat=5.22&lng=-3.74&radius_km=1", nil)
		for _, c := range arr {
			if c.(map[string]any)["id"] == id {
				return c.(map[string]any)
			}
		}
		return nil
	}
	if c := onMapAuth(u.Token, court["id"]); c == nil || c["status"] != "pending" {
		t.Fatalf("proposer pending preview on map = %v", c)
	}
	e.must(200, u.Token, "GET", "/api/courts/"+court["id"].(string), nil)
	other := e.register("courtspy")
	if code, body, _ := e.do(other.Token, "GET", "/api/courts/"+court["id"].(string), nil); code != 404 {
		t.Fatalf("other user pending court leak: %d %v", code, body)
	}
	_, notifs := e.must(200, u.Token, "GET", "/api/me/notifications", nil)
	var foundPendingNote bool
	for _, n := range notifs {
		m := n.(map[string]any)
		if m["type"] == "court_pending_review" {
			foundPendingNote = true
			break
		}
	}
	if !foundPendingNote {
		t.Fatalf("creator missing court_pending_review notification: %v", notifs)
	}

	rejected, _ := e.must(201, u.Token, "POST", "/api/courts", map[string]any{
		"name": "Not A Court", "latitude": 5.2201, "longitude": -3.7401, "sport_ids": []any{bb},
	})
	e.must(204, admin.Token, "POST", "/api/admin/courts/"+rejected["id"].(string)+"/review",
		map[string]any{"approve": false, "reason": "duplicate"})
	if c := onMap(rejected["id"]); c != nil {
		t.Fatalf("rejected court still on map: %v", c)
	}
	_, farPublic := e.must(200, "", "GET", "/api/courts/nearby?lat=0&lng=0&radius_km=1", nil)
	if len(farPublic) != 0 {
		t.Fatalf("public map at 0,0 should be empty: %v", farPublic)
	}
	_, farAdmin := e.must(200, admin.Token, "GET", "/api/courts/nearby?lat=0&lng=0&radius_km=1", nil)
	if len(farAdmin) == 0 {
		t.Fatalf("admin map should list all courts without radius")
	}

	e.must(204, admin.Token, "POST", "/api/admin/courts/"+court["id"].(string)+"/review", map[string]any{"approve": true})
	detail, _ := e.must(200, admin.Token, "GET", "/api/admin/courts/"+court["id"].(string), nil)
	if detail["status"] != "approved" {
		t.Fatalf("admin court detail status = %v", detail["status"])
	}
	e.must(204, admin.Token, "POST", "/api/admin/courts/"+court["id"].(string)+"/review", map[string]any{"pending": true})
	if detail, _ = e.must(200, admin.Token, "GET", "/api/admin/courts/"+court["id"].(string), nil); detail["status"] != "pending" {
		t.Fatalf("after unapprove status = %v", detail["status"])
	}
	e.must(200, "", "GET", "/api/courts/nearby?lat=5.22&lng=-3.74&radius_km=1", nil)

	// Report → admin resolves.
	rep, _ := e.must(201, u.Token, "POST", "/api/courts/"+court["id"].(string)+"/reports", map[string]any{"type": "duplicate"})
	e.must(204, admin.Token, "POST", "/api/admin/reports/"+rep["id"].(string)+"/resolve", map[string]any{"status": "resolved"})

	// Stats + settings.
	stats, _ := e.must(200, admin.Token, "GET", "/api/admin/stats", nil)
	if stats["total_users"].(float64) != 2 || stats["courts"].(float64) != 9 {
		t.Fatalf("stats = %v", stats)
	}
	e.must(200, admin.Token, "PATCH", "/api/admin/settings", map[string]any{"presence_minutes": 45})

	// Suspend blocks login and actions.
	e.must(204, admin.Token, "POST", "/api/admin/users/"+u.ID+"/suspend", map[string]any{"suspended": true})
	e.must(403, "", "POST", "/api/auth/login", map[string]string{"email": "player1@example.com", "password": "password123"})
	_, body, _ := e.do(u.Token, "POST", "/api/games", map[string]any{"court_id": court["id"], "sport_id": bb})
	if body["error"] == nil {
		t.Fatalf("suspended user created a game: %v", body)
	}
	e.must(204, admin.Token, "DELETE", "/api/admin/users/"+u.ID, nil)
	users, _ := e.must(200, admin.Token, "GET", "/api/admin/users", nil)
	_ = users
}

func TestConcurrentJoinsNeverOverfill(t *testing.T) {
	e := setup(t)
	creator := e.register("creator")
	iugb := e.court("Terrain IUGB")
	_, sports := e.must(200, "", "GET", "/api/sports", nil)
	game, _ := e.must(201, creator.Token, "POST", "/api/games", map[string]any{
		"court_id": iugb["id"], "sport_id": sports[0].(map[string]any)["id"], "max_players": 4,
		"latitude": iugbLat, "longitude": iugbLng,
	})
	id := game["id"].(string)

	var players []user
	for i := range 12 {
		players = append(players, e.register(fmt.Sprintf("racer%02d", i)))
	}
	results := make(chan int, len(players))
	for _, p := range players {
		go func() {
			code, _, _ := e.do(p.Token, "POST", "/api/games/"+id+"/join", atCourt())
			results <- code
		}()
	}
	ok := 0
	for range players {
		if <-results == 200 {
			ok++
		}
	}
	if ok != 3 {
		t.Fatalf("%d joins succeeded, want 3 (4 spots incl. creator)", ok)
	}
	g, _ := e.must(200, creator.Token, "GET", "/api/games/"+id, nil)
	if g["player_count"].(float64) != 4 {
		t.Fatalf("player_count = %v", g["player_count"])
	}
}

func TestEmptyGameIsNotActiveAndCreatorsCanBeDeleted(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	admin := e.register("admin")
	host := e.register("host1")
	iugb := e.court("Terrain IUGB")
	_, sports := e.must(200, "", "GET", "/api/sports", nil)
	game, _ := e.must(201, host.Token, "POST", "/api/games", map[string]any{
		"court_id": iugb["id"], "sport_id": sports[0].(map[string]any)["id"],
	})
	if c := e.court("Terrain IUGB"); c["activity"] != "active" {
		t.Fatalf("activity with host = %v", c["activity"])
	}

	// Everyone left: the court is no longer live.
	e.must(200, host.Token, "POST", "/api/games/"+game["id"].(string)+"/leave", nil)
	if c := e.court("Terrain IUGB"); c["activity"] != "inactive" || c["player_count"].(float64) != 0 {
		t.Fatalf("after everyone left: %v / %v", c["activity"], c["player_count"])
	}

	// Deleting a game creator keeps the game and clears creator_id, both via
	// the admin API and directly in the database (no request user).
	e.must(204, admin.Token, "DELETE", "/api/admin/users/"+host.ID, nil)
	other := e.register("host2")
	e.must(201, other.Token, "POST", "/api/games", map[string]any{
		"court_id": iugb["id"], "sport_id": sports[0].(map[string]any)["id"],
	})
	if _, err := e.db.Pool.Exec(ctx, "delete from users where id = $1", other.ID); err != nil {
		t.Fatalf("direct delete: %v", err)
	}
	var orphaned int
	if err := e.db.Pool.QueryRow(ctx, "select count(*) from games where creator_id is null").Scan(&orphaned); err != nil || orphaned != 2 {
		t.Fatalf("orphaned games = %d, err %v", orphaned, err)
	}
}
