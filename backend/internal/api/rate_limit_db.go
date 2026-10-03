package api

import (
	"context"
	"log/slog"
)

func (s *Server) dbRateLimit(ctx context.Context, bucket, key string, max, windowSecs int) bool {
	var ok bool
	err := s.db.Pool.QueryRow(ctx,
		`select public.rate_limit_allow($1, $2, $3, $4)`,
		bucket, key, max, windowSecs).Scan(&ok)
	if err != nil {
		slog.Warn("rate limit db check failed", "bucket", bucket, "err", err)
		return true
	}
	return ok
}
