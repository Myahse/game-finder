package api

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSessionSameSite(t *testing.T) {
	r := httptest.NewRequest("POST", "https://api.example.com/api/auth/login", nil)
	r.Host = "api.example.com"
	r.Header.Set("Origin", "https://app.example.com")
	if sessionSameSite(r) != http.SameSiteNoneMode {
		t.Fatalf("expected None for cross-origin")
	}

	r2 := httptest.NewRequest("POST", "https://app.example.com/api/auth/login", nil)
	r2.Host = "app.example.com"
	r2.Header.Set("Origin", "https://app.example.com")
	if sessionSameSite(r2) != http.SameSiteLaxMode {
		t.Fatalf("expected Lax for same-origin")
	}
}
