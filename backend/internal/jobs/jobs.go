// Package jobs runs the periodic lifecycle work: game start/finish, presence
// expiry, notification generation (public.tick()) and push dispatch.
package jobs

import (
	"context"
	"log/slog"
	"time"

	"findthegame/backend/internal/db"
	"findthegame/backend/internal/push"
)

func Run(ctx context.Context, d *db.DB, dispatcher *push.Dispatcher, every time.Duration) {
	t := time.NewTicker(every)
	defer t.Stop()
	for {
		RunOnce(ctx, d, dispatcher)
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
	}
}

// RunOnce is safe to call from several API instances: tick() uses row-level
// updates and the dispatcher uses SKIP LOCKED.
func RunOnce(ctx context.Context, d *db.DB, dispatcher *push.Dispatcher) {
	var summary []byte
	if err := d.Pool.QueryRow(ctx, "select public.tick()::text").Scan(&summary); err != nil {
		if ctx.Err() == nil {
			slog.Error("tick failed", "err", err)
		}
		return
	}
	slog.Debug("tick", "summary", string(summary))
	if dispatcher != nil {
		if err := dispatcher.Run(ctx); err != nil && ctx.Err() == nil {
			slog.Error("push dispatch failed", "err", err)
		}
	}
}
