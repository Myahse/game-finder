package jeu

import (
	"context"
	"testing"
	"time"
)

func TestSeatKeptThroughAReload(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // no ticking: the test drives the lobby itself
	h := NewHub(ctx, Deps{})
	now := time.Unix(1_700_000_000, 0)
	h.now = func() time.Time { return now }
	room, err := h.CreateRoom("u-ana", "court", "tennis", 1)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := h.CreateRoom("u-ben", "court", "tennis", 3); err != ErrBadTeams {
		t.Fatalf("tennis 3v3 accepted: %v", err)
	}
	r := h.rooms[room.Code]
	ana := &conn{userID: "u-ana", send: make(chan []byte, 64)}
	h.mu.Lock()
	h.joinLocked(ana, room.Code)
	h.leaveLocked(ana) // the page reloads
	now = now.Add(5 * time.Second)
	h.lobbyTickLocked(r, now)
	if r.slots[0] != "u-ana" {
		t.Fatalf("spot lost on a reload: %v", r.slots)
	}
	h.joinLocked(ana, room.Code)
	h.leaveLocked(ana) // gone for good
	now = now.Add(seatGrace + time.Second)
	h.lobbyTickLocked(r, now)
	if r.slots[0] != "" {
		t.Fatalf("spot kept after leaving: %v", r.slots)
	}
	h.mu.Unlock()
}
