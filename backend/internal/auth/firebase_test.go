package auth

import (
	"context"
	"os"
	"testing"
)

// Optional: TEST_FIREBASE_TOKEN=<jwt> TEST_FIREBASE_PROJECT_ID=gamefinder-ced2a go test -run LiveFirebase
func TestLiveFirebaseToken(t *testing.T) {
	tok := os.Getenv("TEST_FIREBASE_TOKEN")
	pid := os.Getenv("TEST_FIREBASE_PROJECT_ID")
	if tok == "" || pid == "" {
		t.Skip("set TEST_FIREBASE_TOKEN and TEST_FIREBASE_PROJECT_ID")
	}
	id, err := NewFirebaseVerifier(pid).Verify(context.Background(), tok)
	if err != nil {
		t.Fatal(err)
	}
	if id.Email == "" || id.Subject == "" {
		t.Fatalf("identity: %+v", id)
	}
}
