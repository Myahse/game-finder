// Package push delivers queued notifications to devices through Firebase
// Cloud Messaging (HTTP v1). Works for Flutter Android/iOS and web push.
// When FCM is not configured, notifications stay in-app only.
package push

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"

	"findthegame/backend/internal/db"
)

type Sender interface {
	// Send returns invalidToken=true when the device token should be deleted.
	Send(ctx context.Context, token, title, body string, data map[string]string) (invalidToken bool, err error)
}

type FCM struct {
	projectID string
	client    *http.Client
}

func NewFCM(ctx context.Context, projectID, serviceAccountJSON string) (*FCM, error) {
	creds, err := google.CredentialsFromJSON(ctx, []byte(serviceAccountJSON),
		"https://www.googleapis.com/auth/firebase.messaging")
	if err != nil {
		return nil, fmt.Errorf("fcm credentials: %w", err)
	}
	return &FCM{projectID: projectID, client: oauth2.NewClient(ctx, creds.TokenSource)}, nil
}

func (f *FCM) Send(ctx context.Context, token, title, body string, data map[string]string) (bool, error) {
	msg := map[string]any{
		"message": map[string]any{
			"token":        token,
			"notification": map[string]string{"title": title, "body": body},
			"data":         data,
			"android":      map[string]any{"priority": "high"},
			// Web push: deliver promptly and keep for a day if the device is offline.
			"webpush": map[string]any{"headers": map[string]string{"Urgency": "high", "TTL": "86400"}},
		},
	}
	b, _ := json.Marshal(msg)
	url := fmt.Sprintf("https://fcm.googleapis.com/v1/projects/%s/messages:send", f.projectID)
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	resp, err := f.client.Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusOK {
		return false, nil
	}
	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	// 404 UNREGISTERED / 400 INVALID_ARGUMENT on the token: drop it.
	invalid := resp.StatusCode == http.StatusNotFound ||
		(resp.StatusCode == http.StatusBadRequest && bytes.Contains(respBody, []byte("registration token")))
	return invalid, fmt.Errorf("fcm %d: %s", resp.StatusCode, respBody)
}

// Dispatcher sends notifications rows that have push=true and no pushed_at.
type Dispatcher struct {
	DB     *db.DB
	Sender Sender // nil = push disabled; rows are just marked as handled
}

func (d *Dispatcher) Run(ctx context.Context) error {
	rows, err := d.DB.Pool.Query(ctx, `
		update public.notifications n set pushed_at = now()
		where n.id in (
			select id from public.notifications
			where push and pushed_at is null and created_at > now() - interval '1 hour'
			order by created_at
			limit 200
			for update skip locked
		)
		returning n.id, n.user_id, n.type::text, n.title, n.body, n.data`)
	if err != nil {
		return err
	}
	type item struct {
		id, userID, typ, title, body string
		data                         map[string]any
	}
	var items []item
	for rows.Next() {
		var it item
		if err := rows.Scan(&it.id, &it.userID, &it.typ, &it.title, &it.body, &it.data); err != nil {
			rows.Close()
			return err
		}
		items = append(items, it)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}
	if d.Sender == nil || len(items) == 0 {
		return nil
	}

	sent := 0
	for _, it := range items {
		tokens, err := d.tokens(ctx, it.userID)
		if err != nil {
			return err
		}
		data := map[string]string{"notification_id": it.id, "type": it.typ}
		for k, v := range it.data {
			data[k] = fmt.Sprint(v)
		}
		for _, tok := range tokens {
			sctx, cancel := context.WithTimeout(ctx, 10*time.Second)
			invalid, err := d.Sender.Send(sctx, tok, it.title, it.body, data)
			cancel()
			if invalid {
				_, _ = d.DB.Pool.Exec(ctx, "delete from public.push_tokens where token = $1", tok)
			}
			if err != nil {
				slog.Warn("push failed", "notification", it.id, "err", err)
			} else {
				sent++
			}
		}
	}
	slog.Info("push dispatched", "notifications", len(items), "delivered", sent)
	return nil
}

func (d *Dispatcher) tokens(ctx context.Context, userID string) ([]string, error) {
	rows, err := d.DB.Pool.Query(ctx, "select token from public.push_tokens where user_id = $1", userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var t string
		if err := rows.Scan(&t); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}
