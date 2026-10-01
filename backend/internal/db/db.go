// Package db wraps the pgx pool with the conventions the SQL layer expects:
// every request that acts on behalf of a user runs inside a transaction with
// app.user_id set, so SQL functions can call app_uid().
package db

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type DB struct {
	Pool *pgxpool.Pool
}

func Connect(ctx context.Context, url string) (*DB, error) {
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, fmt.Errorf("parse database url: %w", err)
	}
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}
	return &DB{Pool: pool}, nil
}

func (d *DB) Close() { d.Pool.Close() }

// Tx runs fn in a transaction. When userID is non-empty it is exposed to SQL
// as app.user_id for the duration of the transaction.
func (d *DB) Tx(ctx context.Context, userID string, fn func(pgx.Tx) error) error {
	tx, err := d.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck // no-op after commit
	if userID != "" {
		if _, err := tx.Exec(ctx, "select set_config('app.user_id', $1, true)", userID); err != nil {
			return err
		}
	}
	if err := fn(tx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// JSON runs a query that returns a single json/jsonb column and returns the
// raw bytes. pgx.ErrNoRows is returned when there is no row.
func (d *DB) JSON(ctx context.Context, userID, query string, args ...any) ([]byte, error) {
	var out []byte
	err := d.Tx(ctx, userID, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, query, args...).Scan(&out)
	})
	return out, err
}

// Exec runs a statement on behalf of userID.
func (d *DB) Exec(ctx context.Context, userID, query string, args ...any) error {
	return d.Tx(ctx, userID, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, query, args...)
		return err
	})
}

// AppError extracts the business error code raised by SQL functions
// (RAISE EXCEPTION 'game_full' USING ERRCODE = 'P0001').
func AppError(err error) (string, bool) {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "P0001", "42501":
			return pgErr.Message, true
		case "23505":
			return "already_exists:" + pgErr.ConstraintName, true
		case "23514":
			return "invalid:" + pgErr.ConstraintName, true
		case "23503":
			return "invalid_reference", true
		case "22P02":
			return "invalid_input", true
		}
	}
	return "", false
}

// Migrate applies every *.sql file in fsys that has not been applied yet, in
// lexical order, each in its own transaction.
func (d *DB) Migrate(ctx context.Context, fsys fs.FS) error {
	if _, err := d.Pool.Exec(ctx, `create table if not exists schema_migrations (
		version text primary key, applied_at timestamptz not null default now())`); err != nil {
		return err
	}
	entries, err := fs.ReadDir(fsys, ".")
	if err != nil {
		return err
	}
	var names []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".sql") {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)

	// Serialise concurrent API instances starting at the same time.
	conn, err := d.Pool.Acquire(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()
	if _, err := conn.Exec(ctx, "select pg_advisory_lock(727274)"); err != nil {
		return err
	}
	defer conn.Exec(context.Background(), "select pg_advisory_unlock(727274)") //nolint:errcheck

	for _, name := range names {
		var exists bool
		if err := conn.QueryRow(ctx, "select exists(select 1 from schema_migrations where version=$1)", name).Scan(&exists); err != nil {
			return err
		}
		if exists {
			continue
		}
		sqlBytes, err := fs.ReadFile(fsys, name)
		if err != nil {
			return err
		}
		tx, err := conn.Begin(ctx)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, string(sqlBytes)); err != nil {
			tx.Rollback(ctx) //nolint:errcheck
			return fmt.Errorf("migration %s: %w", name, err)
		}
		if _, err := tx.Exec(ctx, "insert into schema_migrations(version) values ($1)", name); err != nil {
			tx.Rollback(ctx) //nolint:errcheck
			return err
		}
		if err := tx.Commit(ctx); err != nil {
			return err
		}
		slog.Info("applied migration", "version", name)
	}
	return nil
}

// IsNoRows reports whether err means "nothing found".
func IsNoRows(err error) bool { return errors.Is(err, pgx.ErrNoRows) }
