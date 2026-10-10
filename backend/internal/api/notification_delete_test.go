package api_test

import "testing"

// Swiping a notification away deletes it, only for its owner.
func TestDeleteNotification(t *testing.T) {
	e := setup(t)
	ana := e.register("ana")
	ben := e.register("ben")
	court := e.court("Terrain IUGB")["id"].(string)
	_, sports := e.must(200, "", "GET", "/api/sports", nil)
	basket := sports[0].(map[string]any)["id"].(string)
	e.must(201, ana.Token, "POST", "/api/challenges", map[string]any{"opponent_id": ben.ID, "sport_id": basket, "format": "bball_1v1_11", "court_id": court})

	count := func() (int, string) {
		obj, _ := e.must(200, ben.Token, "GET", "/api/notifications", nil)
		items := obj["items"].([]any)
		if len(items) == 0 {
			return 0, ""
		}
		return len(items), items[0].(map[string]any)["id"].(string)
	}
	n, id := count()
	if n == 0 {
		t.Fatal("ben has no notification")
	}
	e.must(204, ana.Token, "DELETE", "/api/notifications/"+id, nil)
	if after, _ := count(); after != n {
		t.Fatalf("someone else deleted ben's notification: %d -> %d", n, after)
	}
	e.must(204, ben.Token, "DELETE", "/api/notifications/"+id, nil)
	if after, _ := count(); after != n-1 {
		t.Fatalf("after delete = %d, want %d", after, n-1)
	}
}
