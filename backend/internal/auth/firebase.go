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

const defaultFirebaseJWKSURL = "https://www.googleapis.com/oauth2/v3/certs"

// FirebaseVerifier checks Firebase Auth ID tokens (RS256, Google-issued keys).
type FirebaseVerifier struct {
	projectID string
	jwks      *rsaJWKS
}

func NewFirebaseVerifier(projectID string) *FirebaseVerifier {
	projectID = strings.TrimSpace(projectID)
	if projectID == "" {
		return &FirebaseVerifier{}
	}
	return &FirebaseVerifier{
		projectID: projectID,
		jwks:      newRSAJWKS(defaultFirebaseJWKSURL),
	}
}

func (v *FirebaseVerifier) WithJWKSURL(url string) *FirebaseVerifier {
	if v != nil && v.jwks != nil && url != "" {
		v.jwks.url = url
	}
	return v
}

func (v *FirebaseVerifier) Enabled() bool { return v != nil && v.projectID != "" }

var ErrFirebaseToken = errors.New("invalid firebase id token")

type firebaseClaims struct {
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
	Firebase      struct {
		Identities     map[string][]string `json:"identities"`
		SignInProvider string              `json:"sign_in_provider"`
	} `json:"firebase"`
	jwt.RegisteredClaims
}

func (v *FirebaseVerifier) Verify(ctx context.Context, idToken string) (*GoogleIdentity, error) {
	if !v.Enabled() {
		return nil, errors.New("firebase auth not configured")
	}
	wantIss := "https://securetoken.google.com/" + v.projectID
	c := &firebaseClaims{}
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
		return nil, fmt.Errorf("%w: %v", ErrFirebaseToken, err)
	}
	if c.Issuer != wantIss {
		return nil, fmt.Errorf("%w: issuer %q", ErrFirebaseToken, c.Issuer)
	}
	if !slices.Contains(c.Audience, v.projectID) {
		return nil, fmt.Errorf("%w: audience not allowed", ErrFirebaseToken)
	}
	sub := strings.TrimSpace(c.Subject)
	if sub == "" {
		return nil, fmt.Errorf("%w: missing subject", ErrFirebaseToken)
	}
	if ids := c.Firebase.Identities["google.com"]; len(ids) > 0 && strings.TrimSpace(ids[0]) != "" {
		sub = strings.TrimSpace(ids[0])
	}
	given, family := "", ""
	if parts := strings.Fields(strings.TrimSpace(c.Name)); len(parts) > 0 {
		given = parts[0]
		if len(parts) > 1 {
			family = strings.Join(parts[1:], " ")
		}
	}
	id := &GoogleIdentity{
		Subject:       sub,
		Email:         strings.ToLower(strings.TrimSpace(c.Email)),
		EmailVerified: c.EmailVerified,
		GivenName:     given,
		FamilyName:    family,
		Name:          strings.TrimSpace(c.Name),
		Picture:       strings.TrimSpace(c.Picture),
	}
	if c.Firebase.SignInProvider != "" && c.Firebase.SignInProvider != "google.com" && len(c.Firebase.Identities["google.com"]) == 0 {
		return nil, fmt.Errorf("%w: sign-in provider %q not supported", ErrFirebaseToken, c.Firebase.SignInProvider)
	}
	return id, nil
}
