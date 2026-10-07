package api_test

import "testing"

// The auth bucket allows 30 attempts per minute per IP; the 31st is refused.
func TestAuthRateLimit(t *testing.T) {
	e := setup(t)
	body := map[string]string{"login": "nobody", "password": "wrong-password"}
	for i := range 30 {
		if code, _, _ := e.do("", "POST", "/api/auth/login", body); code == 429 {
			t.Fatalf("limited too early, at attempt %d", i+1)
		}
	}
	e.must(429, "", "POST", "/api/auth/login", body)
}
