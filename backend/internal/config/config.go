// Package config loads runtime configuration from environment variables.
package config

import (
	"errors"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Addr            string
	DatabaseURL     string
	JWTSecret       []byte
	AccessTokenTTL  time.Duration
	RefreshTokenTTL time.Duration
	CORSOrigins     []string
	AdminEmails     []string // accounts registered with these emails become admins
	// When false, POST /api/auth/register is disabled (use Google/Firebase sign-in).
	PasswordRegistration bool
	// When false, only CORS_ORIGINS are allowed (no wildcard *.vercel.app).
	AllowVercelPreviews bool
	UploadDir       string
	PublicBaseURL   string // used to build absolute upload URLs
	MaxUploadBytes  int64
	TickInterval    time.Duration
	SeedDemo        bool
	// Firebase Cloud Messaging (HTTP v1). Push is disabled when empty.
	FCMProjectID          string
	FCMServiceAccountJSON string
	// Comma-separated CIDRs; X-Real-IP is trusted only from these peers (e.g. nginx in Docker).
	TrustedProxyCIDRs string
	// Cloudflare R2 (S3-compatible). When set, uploads go to the bucket instead of UPLOAD_DIR.
	R2AccountID       string
	R2AccessKeyID     string
	R2SecretAccessKey string
	R2BucketName      string
	R2PublicURL       string // public bucket URL or custom domain (no trailing slash)
	// Google Sign-In: OAuth client IDs whose ID tokens we accept (web, Android,
	// iOS). Empty disables /api/auth/google.
	GoogleClientIDs []string
	GoogleJWKSURL   string // override Google's key set URL (tests only)
	// Firebase Auth (Google via Firebase). Project ID verifies ID tokens on
	// /api/auth/firebase. Falls back to FCM_PROJECT_ID when empty.
	FirebaseProjectID string
	FirebaseJWKSURL   string // tests only
}

func (c Config) R2Enabled() bool {
	return c.R2AccountID != "" && c.R2AccessKeyID != "" && c.R2SecretAccessKey != "" && c.R2BucketName != ""
}

func Load() (Config, error) {
	c := Config{
		Addr:                  env("ADDR", ":8080"),
		DatabaseURL:           env("DATABASE_URL", ""),
		JWTSecret:             []byte(env("JWT_SECRET", "")),
		AccessTokenTTL:        duration("ACCESS_TOKEN_TTL", 15*time.Minute),
		RefreshTokenTTL:       duration("REFRESH_TOKEN_TTL", 30*24*time.Hour),
		CORSOrigins: list(
			"CORS_ORIGINS",
			"http://localhost:5173,http://localhost:9099,https://game-finder-swart.vercel.app",
		),
		AdminEmails:           list("ADMIN_EMAILS", ""),
		PasswordRegistration:  env("PASSWORD_REGISTRATION", "true") == "true",
		AllowVercelPreviews:   env("ALLOW_VERCEL_PREVIEWS", "true") == "true",
		UploadDir:             env("UPLOAD_DIR", "./uploads"),
		PublicBaseURL:         strings.TrimRight(env("PUBLIC_BASE_URL", "http://localhost:8080"), "/"),
		MaxUploadBytes:        int64(intEnv("MAX_UPLOAD_MB", 8)) << 20,
		TickInterval:          duration("TICK_INTERVAL", time.Minute),
		SeedDemo:              env("SEED_DEMO", "false") == "true",
		FCMProjectID:          env("FCM_PROJECT_ID", ""),
		FCMServiceAccountJSON: env("FCM_SERVICE_ACCOUNT_JSON", ""),
		TrustedProxyCIDRs:     env("TRUSTED_PROXY_CIDRS", "127.0.0.0/8,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16"),
		R2AccountID:           env("R2_ACCOUNT_ID", ""),
		R2AccessKeyID:         env("R2_ACCESS_KEY_ID", ""),
		R2SecretAccessKey:     env("R2_SECRET_ACCESS_KEY", ""),
		R2BucketName:          env("R2_BUCKET_NAME", ""),
		R2PublicURL:           strings.TrimRight(env("R2_PUBLIC_URL", ""), "/"),
		GoogleClientIDs:       rawList("GOOGLE_CLIENT_IDS"),
		FirebaseProjectID:     strings.TrimSpace(env("FIREBASE_PROJECT_ID", env("FCM_PROJECT_ID", ""))),
	}
	// PaaS (Render, Railway, …) inject PORT; prefer it over Dockerfile ADDR=:8080.
	if port := strings.TrimSpace(os.Getenv("PORT")); port != "" {
		c.Addr = ":" + port
	}

	if c.DatabaseURL == "" {
		return c, errors.New("DATABASE_URL is required")
	}
	if len(c.JWTSecret) < 32 {
		return c, errors.New("JWT_SECRET must be at least 32 characters")
	}
	return c, nil
}

func env(key, def string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return def
}

func intEnv(key string, def int) int {
	if n, err := strconv.Atoi(os.Getenv(key)); err == nil {
		return n
	}
	return def
}

func duration(key string, def time.Duration) time.Duration {
	if d, err := time.ParseDuration(os.Getenv(key)); err == nil {
		return d
	}
	return def
}

// rawList splits a comma-separated value without changing case.
func rawList(key string) []string {
	var out []string
	for _, s := range strings.Split(os.Getenv(key), ",") {
		if s = strings.TrimSpace(s); s != "" {
			out = append(out, s)
		}
	}
	return out
}

func list(key, def string) []string {
	var out []string
	for _, s := range strings.Split(env(key, def), ",") {
		if s = strings.TrimSpace(s); s != "" {
			out = append(out, strings.ToLower(s))
		}
	}
	return out
}
