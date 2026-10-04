// Package realtime fans database events (LISTEN ftg_events) out to WebSocket
// clients. Public events (court stats, games) go to everyone; notification
// events go only to the connections of the user they belong to.
package realtime

import (
	"context"
	"encoding/json"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/coder/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
)

const channel = "ftg_events"

type client struct {
	userID string
	send   chan []byte
}

type Hub struct {
	mu      sync.RWMutex
	clients map[*client]struct{}
}

func NewHub() *Hub {
	return &Hub{clients: make(map[*client]struct{})}
}

// Listen holds a dedicated connection and forwards notifications until ctx ends.
// It reconnects with back-off if the connection drops.
func (h *Hub) Listen(ctx context.Context, pool *pgxpool.Pool) {
	backoff := time.Second
	for ctx.Err() == nil {
		err := h.listenOnce(ctx, pool)
		if ctx.Err() != nil {
			return
		}
		slog.Warn("realtime listener stopped, reconnecting", "err", err, "in", backoff)
		select {
		case <-time.After(backoff):
		case <-ctx.Done():
			return
		}
		if backoff < 30*time.Second {
			backoff *= 2
		}
	}
}

func (h *Hub) listenOnce(ctx context.Context, pool *pgxpool.Pool) error {
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()
	if _, err := conn.Exec(ctx, "listen "+channel); err != nil {
		return err
	}
	slog.Info("realtime listening", "channel", channel)
	for {
		n, err := conn.Conn().WaitForNotification(ctx)
		if err != nil {
			return err
		}
		h.dispatch([]byte(n.Payload))
	}
}

type envelope struct {
	Type   string `json:"type"`
	UserID string `json:"user_id,omitempty"`
}

func (h *Hub) dispatch(payload []byte) {
	var env envelope
	if err := json.Unmarshal(payload, &env); err != nil {
		slog.Warn("bad realtime payload", "err", err)
		return
	}
	private := env.Type == "notification"
	if private {
		// Don't leak the recipient id to the client payload.
		var m map[string]any
		if json.Unmarshal(payload, &m) == nil {
			delete(m, "user_id")
			payload, _ = json.Marshal(m)
		}
	}

	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.clients {
		if private && normConnUserID(c.userID) != normConnUserID(env.UserID) {
			continue
		}
		select {
		case c.send <- payload:
		default: // slow client: drop the event rather than block everyone
		}
	}
}

// Serve upgrades the request and pumps events until the client disconnects.
// userID may be empty for anonymous map browsing.
func (h *Hub) Serve(ctx context.Context, conn *websocket.Conn, userID string) {
	c := &client{userID: normConnUserID(userID), send: make(chan []byte, 64)}
	h.mu.Lock()
	h.clients[c] = struct{}{}
	h.mu.Unlock()
	defer func() {
		h.mu.Lock()
		delete(h.clients, c)
		h.mu.Unlock()
	}()

	ctx = conn.CloseRead(ctx) // we don't expect client messages; this handles pings/close
	ping := time.NewTicker(25 * time.Second)
	defer ping.Stop()

	_ = conn.Write(ctx, websocket.MessageText, []byte(`{"type":"hello"}`))
	for {
		select {
		case <-ctx.Done():
			conn.Close(websocket.StatusNormalClosure, "")
			return
		case msg := <-c.send:
			wctx, cancel := context.WithTimeout(ctx, 10*time.Second)
			err := conn.Write(wctx, websocket.MessageText, msg)
			cancel()
			if err != nil {
				return
			}
		case <-ping.C:
			pctx, cancel := context.WithTimeout(ctx, 10*time.Second)
			err := conn.Ping(pctx)
			cancel()
			if err != nil {
				return
			}
		}
	}
}

func normConnUserID(id string) string {
	return strings.ToLower(strings.TrimSpace(id))
}

func (h *Hub) Count() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}
