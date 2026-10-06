// Command api runs the Find the Game HTTP/WebSocket API, applies database
// migrations on start-up and runs the background lifecycle jobs.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"findthegame/backend/internal/api"
	"findthegame/backend/internal/config"
	"findthegame/backend/internal/db"
	"findthegame/backend/internal/jobs"
	"findthegame/backend/internal/push"
	"findthegame/backend/internal/realtime"
	"findthegame/backend/internal/storage"
	"findthegame/backend/migrations"
	"findthegame/backend/seed"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))
	if err := run(); err != nil {
		slog.Error("fatal", "err", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	d, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer d.Close()
	if err := d.Migrate(ctx, migrations.FS); err != nil {
		return err
	}
	if cfg.SeedDemo {
		if _, err := d.Pool.Exec(ctx, seed.Demo); err != nil {
			return err
		}
		slog.Info("demo courts seeded")
	}
	media, err := storage.NewMedia(cfg)
	if err != nil {
		return err
	}
	if media.UsesR2() {
		slog.Info("uploads enabled", "backend", "cloudflare_r2", "public", cfg.R2PublicURL)
	} else {
		if err := os.MkdirAll(cfg.UploadDir, 0o755); err != nil {
			return err
		}
		slog.Info("uploads enabled", "backend", "local_disk", "dir", cfg.UploadDir)
	}

	hub := realtime.NewHub()
	go hub.Listen(ctx, d.Pool)

	dispatcher := &push.Dispatcher{DB: d}
	if cfg.FCMProjectID != "" && cfg.FCMServiceAccountJSON != "" {
		fcm, err := push.NewFCM(ctx, cfg.FCMProjectID, cfg.FCMServiceAccountJSON)
		if err != nil {
			return err
		}
		dispatcher.Sender = fcm
		slog.Info("push notifications enabled (FCM)")
	} else {
		slog.Warn("FCM not configured: notifications are in-app only")
	}
	go jobs.Run(ctx, d, dispatcher, cfg.TickInterval)

	srv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           api.New(cfg, d, hub, media).WithPush(dispatcher.Sender).Routes(),
		ReadHeaderTimeout: 10 * time.Second,
	}
	errCh := make(chan error, 1)
	go func() {
		slog.Info("listening", "addr", cfg.Addr)
		errCh <- srv.ListenAndServe()
	}()

	select {
	case err := <-errCh:
		if !errors.Is(err, http.ErrServerClosed) {
			return err
		}
	case <-ctx.Done():
	}
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}
