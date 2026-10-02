package auth

import (
	"context"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const googleJWKSURL = "https://www.googleapis.com/oauth2/v3/certs"

var googleIssuers = []string{"accounts.google.com", "https://accounts.google.com"}

// GoogleIdentity is what we trust from a verified Google ID token.
type GoogleIdentity struct {
	Subject       string `json:"-"` // from the standard "sub" claim
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	GivenName     string `json:"given_name"`
	FamilyName    string `json:"family_name"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
}

type googleClaims struct {
	GoogleIdentity
	jwt.RegisteredClaims
}

// GoogleVerifier checks Google Sign-In ID tokens (RS256, signed by Google's
// rotating keys) and that they were issued to one of our OAuth client IDs.
type GoogleVerifier struct {
	clientIDs []string
	jwksURL   string
	client    *http.Client

	mu      sync.Mutex
	keys    map[string]*rsa.PublicKey
	expires time.Time
}

func NewGoogleVerifier(clientIDs []string) *GoogleVerifier {
	return &GoogleVerifier{
		clientIDs: clientIDs,
		jwksURL:   googleJWKSURL,
		client:    &http.Client{Timeout: 10 * time.Second},
	}
}

// WithJWKSURL points the verifier at another key set (tests).
func (v *GoogleVerifier) WithJWKSURL(url string) *GoogleVerifier {
	v.jwksURL = url
	return v
}

func (v *GoogleVerifier) Enabled() bool { return v != nil && len(v.clientIDs) > 0 }

var ErrGoogleToken = errors.New("invalid google id token")

func (v *GoogleVerifier) Verify(ctx context.Context, idToken string) (*GoogleIdentity, error) {
	if !v.Enabled() {
		return nil, errors.New("google sign-in not configured")
	}
	c := &googleClaims{}
	_, err := jwt.ParseWithClaims(idToken, c, func(t *jwt.Token) (any, error) {
		kid, _ := t.Header["kid"].(string)
		return v.key(ctx, kid)
	},
		jwt.WithValidMethods([]string{"RS256"}),
		jwt.WithExpirationRequired(),
		jwt.WithIssuedAt(),
		jwt.WithLeeway(30*time.Second),
	)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrGoogleToken, err)
	}
	if !slices.Contains(googleIssuers, c.Issuer) {
		return nil, fmt.Errorf("%w: issuer %q", ErrGoogleToken, c.Issuer)
	}
	if !slices.ContainsFunc(c.Audience, func(a string) bool { return slices.Contains(v.clientIDs, a) }) {
		return nil, fmt.Errorf("%w: audience not allowed", ErrGoogleToken)
	}
	c.GoogleIdentity.Subject = c.RegisteredClaims.Subject
	if c.GoogleIdentity.Subject == "" {
		return nil, fmt.Errorf("%w: missing subject", ErrGoogleToken)
	}
	id := c.GoogleIdentity
	id.Email = strings.ToLower(strings.TrimSpace(id.Email))
	return &id, nil
}

// key returns the signing key for kid, refreshing the cached JWKS when it has
// expired or the kid is unknown (Google rotates keys).
func (v *GoogleVerifier) key(ctx context.Context, kid string) (*rsa.PublicKey, error) {
	v.mu.Lock()
	defer v.mu.Unlock()
	if k, ok := v.keys[kid]; ok && time.Now().Before(v.expires) {
		return k, nil
	}
	if err := v.fetch(ctx); err != nil {
		return nil, err
	}
	if k, ok := v.keys[kid]; ok {
		return k, nil
	}
	return nil, fmt.Errorf("unknown signing key %q", kid)
}

func (v *GoogleVerifier) fetch(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, v.jwksURL, nil)
	if err != nil {
		return err
	}
	resp, err := v.client.Do(req)
	if err != nil {
		return fmt.Errorf("fetch google keys: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("fetch google keys: status %d", resp.StatusCode)
	}
	var set struct {
		Keys []struct {
			Kid string `json:"kid"`
			Kty string `json:"kty"`
			N   string `json:"n"`
			E   string `json:"e"`
		} `json:"keys"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&set); err != nil {
		return fmt.Errorf("decode google keys: %w", err)
	}
	keys := make(map[string]*rsa.PublicKey, len(set.Keys))
	for _, k := range set.Keys {
		if k.Kty != "RSA" {
			continue
		}
		n, err1 := base64.RawURLEncoding.DecodeString(k.N)
		e, err2 := base64.RawURLEncoding.DecodeString(k.E)
		if err1 != nil || err2 != nil {
			continue
		}
		keys[k.Kid] = &rsa.PublicKey{N: new(big.Int).SetBytes(n), E: int(new(big.Int).SetBytes(e).Int64())}
	}
	if len(keys) == 0 {
		return errors.New("google key set is empty")
	}
	v.keys = keys
	v.expires = time.Now().Add(cacheTTL(resp.Header.Get("Cache-Control")))
	return nil
}

// cacheTTL honours Cache-Control max-age (Google sends ~6h), within bounds.
func cacheTTL(cc string) time.Duration {
	for _, part := range strings.Split(cc, ",") {
		part = strings.TrimSpace(part)
		if s, ok := strings.CutPrefix(part, "max-age="); ok {
			if n, err := strconv.Atoi(s); err == nil {
				return min(max(time.Duration(n)*time.Second, 5*time.Minute), 24*time.Hour)
			}
		}
	}
	return time.Hour
}
