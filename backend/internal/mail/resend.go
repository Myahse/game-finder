package mail

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type Resend struct {
	apiKey string
	from   string
}

func NewResend(apiKey, from string) *Resend {
	apiKey = strings.TrimSpace(apiKey)
	from = strings.TrimSpace(from)
	if apiKey == "" || from == "" {
		return nil
	}
	return &Resend{apiKey: apiKey, from: from}
}

func (r *Resend) Enabled() bool { return r != nil }

func (r *Resend) SendVerification(ctx context.Context, to, verifyURL string) error {
	payload := map[string]any{
		"from":    r.from,
		"to":      []string{to},
		"subject": "Verify your Find the Game email",
		"html": fmt.Sprintf(
			`<p>Confirm your email to use Find the Game.</p><p><a href="%s">Verify email</a></p><p>This link expires in 48 hours.</p>`,
			verifyURL,
		),
	}
	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(payload); err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.resend.com/emails", &buf)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+r.apiKey)
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 15 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		return fmt.Errorf("resend status %d", res.StatusCode)
	}
	return nil
}
