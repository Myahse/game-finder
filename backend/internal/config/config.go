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
}

func Load() (Config, error) {
	c := Config{
		Addr:                  env("ADDR", ":8080"),
		DatabaseURL:           env("DATABASE_URL", ""),
		JWTSecret:             []byte(env("JWT_SECRET", "")),
		AccessTokenTTL:        duration("ACCESS_TOKEN_TTL", 15*time.Minute),
		RefreshTokenTTL:       duration("REFRESH_TOKEN_TTL", 30*24*time.Hour),
		CORSOrigins:           list("CORS_ORIGINS", "http://localhost:5173"),
		AdminEmails:           list("ADMIN_EMAILS", ""),
		UploadDir:             env("UPLOAD_DIR", "./uploads"),
		PublicBaseURL:         strings.TrimRight(env("PUBLIC_BASE_URL", "http://localhost:8080"), "/"),
		MaxUploadBytes:        int64(intEnv("MAX_UPLOAD_MB", 8)) << 20,
		TickInterval:          duration("TICK_INTERVAL", time.Minute),
		SeedDemo:              env("SEED_DEMO", "false") == "true",
		FCMProjectID:          env("FCM_PROJECT_ID", ""),
		FCMServiceAccountJSON: env("FCM_SERVICE_ACCOUNT_JSON", ""),
		TrustedProxyCIDRs:     env("TRUSTED_PROXY_CIDRS", "127.0.0.0/8,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16"),
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

func list(key, def string) []string {
	var out []string
	for _, s := range strings.Split(env(key, def), ",") {
		if s = strings.TrimSpace(s); s != "" {
			out = append(out, strings.ToLower(s))
		}
	}
	return out
}
