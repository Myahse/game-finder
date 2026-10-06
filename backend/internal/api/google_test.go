package api_test

import (
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const fakeGoogleClientID = "test-client.apps.googleusercontent.com"

// fakeGoogle signs ID tokens and serves the matching JWKS, standing in for
// accounts.google.com.
type fakeGoogle struct {
	key  *rsa.PrivateKey
	jwks *httptest.Server
}

func newFakeGoogle(t *testing.T) *fakeGoogle {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	f := &fakeGoogle{key: key}
	f.jwks = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Cache-Control", "public, max-age=3600")
		_ = json.NewEncoder(w).Encode(map[string]any{"keys": []map[string]string{{
			"kid": "k1", "kty": "RSA", "alg": "RS256", "use": "sig",
			"n": base64.RawURLEncoding.EncodeToString(key.N.Bytes()),
			"e": base64.RawURLEncoding.EncodeToString(big.NewInt(int64(key.E)).Bytes()),
		}}})
	}))
	t.Cleanup(f.jwks.Close)
	return f
}

// token returns a signed Google ID token; overrides replace default claims.
func (f *fakeGoogle) token(t *testing.T, sub, email string, overrides map[string]any) string {
	t.Helper()
	claims := jwt.MapClaims{
		"iss":            "https://accounts.google.com",
		"aud":            fakeGoogleClientID,
		"sub":            sub,
		"email":          email,
		"email_verified": true,
		"given_name":     "Awa",
		"family_name":    "Koné",
		"name":           "Awa Koné",
		"iat":            time.Now().Unix(),
		"exp":            time.Now().Add(time.Hour).Unix(),
	}
	for k, v := range overrides {
		claims[k] = v
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	tok.Header["kid"] = "k1"
	s, err := tok.SignedString(f.key)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func TestGoogleSignIn(t *testing.T) {
	e := setup(t)

	// New player: account created, goes to onboarding.
	tok := e.google.token(t, "google-123", "awa.kone@gmail.com", nil)
	first, _ := e.must(201, "", "POST", "/api/auth/google", map[string]string{"id_token": tok})
	u := first["user"].(map[string]any)
	if u["first_name"] != "Awa" || u["last_name"] != "Koné" || u["email"] != "awa.kone@gmail.com" ||
		u["username"] != "awa.kone" || u["onboarded"] != false {
		t.Fatalf("created user = %v", u)
	}
	// The session works.
	e.must(200, first["access_token"].(string), "GET", "/api/me", nil)

	// Returning player: same account.
	again, _ := e.must(200, "", "POST", "/api/auth/google", map[string]string{"id_token": e.google.token(t, "google-123", "awa.kone@gmail.com", nil)})
	if again["user"].(map[string]any)["id"] != u["id"] {
		t.Fatal("second sign-in created another account")
	}

	// A Google-only account can't be logged into with an empty password.
	e.must(401, "", "POST", "/api/auth/login", map[string]string{"login": "awa.kone", "password": "anything123"})

	// Password accounts are not auto-linked from Google (prevents email preemption).
	_ = e.register("moussa")
	linkCode, linkBody, _ := e.do("", "POST", "/api/auth/google",
		map[string]string{"id_token": e.google.token(t, "google-456", "moussa@example.com", nil)})
	if linkCode != 409 || linkBody["error"] != "email_password_account" {
		t.Fatalf("expected email_password_account, got %d %v", linkCode, linkBody)
	}
	e.must(200, "", "POST", "/api/auth/login", map[string]string{"login": "moussa", "password": "password123"})

	// awa.kone@gmail.com is tied to google-123; another Google account can't take it.
	_, body, _ := e.do("", "POST", "/api/auth/google",
		map[string]string{"id_token": e.google.token(t, "google-789", "awa.kone@gmail.com", nil)})
	if body["error"] != "google_account_mismatch" {
		t.Fatalf("mismatch: %v", body)
	}

	// Username collision gets a numeric suffix; missing family name is fine.
	other, _ := e.must(201, "", "POST", "/api/auth/google", map[string]string{
		"id_token": e.google.token(t, "google-999", "awa.kone@outlook.com", map[string]any{"family_name": "", "given_name": "Awa"}),
	})
	ou := other["user"].(map[string]any)
	if ou["username"] == "awa.kone" || len(ou["username"].(string)) < 9 || ou["last_name"] != "" {
		t.Fatalf("collision user = %v", ou)
	}

	// Admin emails become admins.
	adm, _ := e.must(201, "", "POST", "/api/auth/google",
		map[string]string{"id_token": e.google.token(t, "google-admin", "admin@example.com", nil)})
	if adm["user"].(map[string]any)["role"] != "admin" {
		t.Fatalf("admin role = %v", adm["user"])
	}

	// Rejected tokens.
	bad := map[string]map[string]any{
		"wrong audience":   {"aud": "someone-elses-app"},
		"wrong issuer":     {"iss": "https://evil.example"},
		"expired":          {"exp": time.Now().Add(-time.Hour).Unix()},
		"unverified email": {"email_verified": false},
	}
	for name, o := range bad {
		code, body, _ := e.do("", "POST", "/api/auth/google", map[string]string{"id_token": e.google.token(t, "x-"+name, "x@example.com", o)})
		if code < 400 {
			t.Fatalf("%s: accepted (%d %v)", name, code, body)
		}
	}
	// Signed by someone else's key.
	stranger := newFakeGoogle(t)
	code, _, _ := e.do("", "POST", "/api/auth/google", map[string]string{"id_token": stranger.token(t, "s", "s@example.com", nil)})
	if code != 401 {
		t.Fatalf("foreign signature: %d", code)
	}

	// Suspended accounts can't sign in with Google either.
	admTok := adm["access_token"].(string)
	e.must(204, admTok, "POST", "/api/admin/users/"+u["id"].(string)+"/suspend", map[string]any{"suspended": true})
	e.must(403, "", "POST", "/api/auth/google", map[string]string{"id_token": e.google.token(t, "google-123", "awa.kone@gmail.com", nil)})
}
