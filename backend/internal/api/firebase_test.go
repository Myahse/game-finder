package api_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"findthegame/backend/internal/api"
	"findthegame/backend/internal/config"
	"findthegame/backend/internal/db"
	"findthegame/backend/internal/realtime"
	"findthegame/backend/internal/storage"
	"findthegame/backend/migrations"
	"findthegame/backend/seed"
)

const fakeFirebaseProject = "ftg-firebase-test"

func (f *fakeGoogle) firebaseAppleToken(t *testing.T, appleSub, email string) string {
	t.Helper()
	claims := jwt.MapClaims{
		"iss":            "https://securetoken.google.com/" + fakeFirebaseProject,
		"aud":            fakeFirebaseProject,
		"sub":            "firebase-uid-apple-1",
		"email":          email,
		"email_verified": true,
		"name":           "Apple User",
		"iat":            time.Now().Unix(),
		"exp":            time.Now().Add(time.Hour).Unix(),
		"firebase": map[string]any{
			"identities":       map[string]any{"apple.com": []string{appleSub}},
			"sign_in_provider": "apple.com",
		},
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	tok.Header["kid"] = "k1"
	s, err := tok.SignedString(f.key)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func (f *fakeGoogle) firebaseToken(t *testing.T, googleSub, email string) string {
	t.Helper()
	claims := jwt.MapClaims{
		"iss":            "https://securetoken.google.com/" + fakeFirebaseProject,
		"aud":            fakeFirebaseProject,
		"sub":            "firebase-uid-1",
		"email":          email,
		"email_verified": true,
		"name":           "Awa Koné",
		"iat":            time.Now().Unix(),
		"exp":            time.Now().Add(time.Hour).Unix(),
		"firebase": map[string]any{
			"identities":       map[string]any{"google.com": []string{googleSub}},
			"sign_in_provider": "google.com",
		},
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	tok.Header["kid"] = "k1"
	s, err := tok.SignedString(f.key)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func setupFirebase(t *testing.T) *env {
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

	google := newFakeGoogle(t)
	cfg := config.Config{
		FirebaseProjectID: fakeFirebaseProject,
		FirebaseJWKSURL:   google.jwks.URL,
		JWTSecret:         []byte(strings.Repeat("s", 32)),
		AccessTokenTTL:    time.Hour,
		RefreshTokenTTL:   time.Hour,
		CORSOrigins:       []string{"*"},
		AdminEmails:       []string{"admin@example.com"},
		UploadDir:         t.TempDir(),
		PublicBaseURL:     "http://test",
		MaxUploadBytes:    1 << 20,
	}
	hub := realtime.NewHub()
	go hub.Listen(ctx, d.Pool)
	media, err := storage.NewMedia(cfg)
	if err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewServer(api.New(cfg, d, hub, media).Routes())
	t.Cleanup(srv.Close)
	time.Sleep(100 * time.Millisecond)
	return &env{t: t, srv: srv, db: d, google: google}
}

func TestFirebaseSignIn(t *testing.T) {
	e := setupFirebase(t)
	tok := e.google.firebaseToken(t, "google-firebase-1", "awa.kone@gmail.com")
	first, _ := e.must(201, "", "POST", "/api/auth/firebase", map[string]string{"id_token": tok})
	u := first["user"].(map[string]any)
	if u["email"] != "awa.kone@gmail.com" || u["onboarded"] != false {
		t.Fatalf("created user = %v", u)
	}
	again, _ := e.must(200, "", "POST", "/api/auth/firebase", map[string]string{"id_token": e.google.firebaseToken(t, "google-firebase-1", "awa.kone@gmail.com")})
	if again["user"].(map[string]any)["id"] != u["id"] {
		t.Fatal("second sign-in created another account")
	}
	code, body, _ := e.do("", "POST", "/api/auth/firebase", map[string]string{"id_token": "bad"})
	if code != http.StatusUnauthorized || body["error"] != "invalid_firebase_token" {
		t.Fatalf("bad token: %d %v", code, body)
	}
}

func TestFirebaseAppleSignIn(t *testing.T) {
	e := setupFirebase(t)
	tok := e.google.firebaseAppleToken(t, "apple-user-1", "apple.player@privaterelay.appleid.com")
	first, _ := e.must(201, "", "POST", "/api/auth/firebase", map[string]string{"id_token": tok})
	u := first["user"].(map[string]any)
	if u["email"] != "apple.player@privaterelay.appleid.com" {
		t.Fatalf("created user = %v", u)
	}
}
