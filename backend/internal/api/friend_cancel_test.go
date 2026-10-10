package api_test

import "testing"

// The sender can withdraw a pending friend request; nobody else can.
func TestCancelFriendRequest(t *testing.T) {
	e := setup(t)
	ana := e.register("ana")
	ben := e.register("ben")
	out := e.register("outsider")
	e.must(200, ana.Token, "POST", "/api/me/friend-requests", map[string]any{"username": "ben"})
	reqs, _ := e.must(200, ana.Token, "GET", "/api/me/friend-requests", nil)
	outgoing := reqs["outgoing"].([]any)
	if len(outgoing) != 1 {
		t.Fatalf("outgoing = %v", outgoing)
	}
	id := outgoing[0].(map[string]any)["id"].(string)
	e.must(204, out.Token, "DELETE", "/api/me/friend-requests/"+id, nil)
	e.must(204, ben.Token, "DELETE", "/api/me/friend-requests/"+id, nil)
	if r, _ := e.must(200, ben.Token, "GET", "/api/me/friend-requests", nil); len(r["incoming"].([]any)) != 1 {
		t.Fatalf("request gone after someone else cancelled: %v", r)
	}
	e.must(204, ana.Token, "DELETE", "/api/me/friend-requests/"+id, nil)
	if r, _ := e.must(200, ben.Token, "GET", "/api/me/friend-requests", nil); len(r["incoming"].([]any)) != 0 {
		t.Fatalf("still incoming after cancel: %v", r)
	}
	// And Ana can ask again.
	e.must(200, ana.Token, "POST", "/api/me/friend-requests", map[string]any{"username": "ben"})
}
