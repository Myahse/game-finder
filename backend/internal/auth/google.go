package auth

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
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
	jwks      *rsaJWKS
}

func NewGoogleVerifier(clientIDs []string) *GoogleVerifier {
	return &GoogleVerifier{
		clientIDs: clientIDs,
		jwks:      newRSAJWKS(googleJWKSURL),
	}
}

// WithJWKSURL points the verifier at another key set (tests).
func (v *GoogleVerifier) WithJWKSURL(url string) *GoogleVerifier {
	if v != nil && v.jwks != nil && url != "" {
		v.jwks.url = url
	}
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
		return v.jwks.key(ctx, kid)
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
