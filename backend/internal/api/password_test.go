package api_test

import "testing"

func TestGoogleAccountAddsPassword(t *testing.T) {
	e := setup(t)
	tok := e.google.token(t, "google-pw", "awa.pw@gmail.com", nil)
	first, _ := e.must(201, "", "POST", "/api/auth/google", map[string]string{"id_token": tok})
	access := first["access_token"].(string)
	username := first["user"].(map[string]any)["username"].(string)
	if first["user"].(map[string]any)["has_password"] != false {
		t.Fatalf("has_password = %v", first["user"])
	}

	// Username + password on a Google-only account says why it fails.
	_, body, _ := e.do("", "POST", "/api/auth/login", map[string]string{"login": username, "password": "whatever123"})
	if body["error"] != "social_account" {
		t.Fatalf("login google-only = %v", body)
	}

	// Add a password (no current password needed the first time).
	e.must(422, access, "POST", "/api/me/password", map[string]string{"new_password": "short"})
	e.must(204, access, "POST", "/api/me/password", map[string]string{"new_password": "courtside42"})
	me, _ := e.must(200, access, "GET", "/api/me", nil)
	if me["has_password"] != true {
		t.Fatalf("me after set = %v", me)
	}
	// Both ways in now work.
	e.must(200, "", "POST", "/api/auth/login", map[string]string{"login": username, "password": "courtside42"})
	e.must(200, "", "POST", "/api/auth/login", map[string]string{"login": "awa.pw@gmail.com", "password": "courtside42"})
	e.must(200, "", "POST", "/api/auth/google", map[string]string{"id_token": e.google.token(t, "google-pw", "awa.pw@gmail.com", nil)})

	// Changing it requires the current password.
	e.must(403, access, "POST", "/api/me/password", map[string]string{"new_password": "newpass123"})
	e.must(403, access, "POST", "/api/me/password", map[string]string{"current_password": "nope12345", "new_password": "newpass123"})
	e.must(204, access, "POST", "/api/me/password", map[string]string{"current_password": "courtside42", "new_password": "newpass123"})
	e.must(200, "", "POST", "/api/auth/login", map[string]string{"login": username, "password": "newpass123"})
	e.must(401, "", "POST", "/api/auth/login", map[string]string{"login": username, "password": "courtside42"})
}
