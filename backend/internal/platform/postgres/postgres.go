// Package postgres opens the connection pool of the database and applies
// the migrations.
package postgres

import (
	"context"
	"fmt"
	"io/fs"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"go.opentelemetry.io/otel"
)

// Open creates a connection pool for the database at url and checks that
// the database responds. Each query makes a span (ADR 0032). The caller
// closes the pool.
func Open(ctx context.Context, url string) (*pgxpool.Pool, error) {
	config, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, fmt.Errorf("parse database url: %w", err)
	}
	// Without the export of ADR 0032 the global tracer is a no-op.
	config.ConnConfig.Tracer = queryTracer{tracer: otel.Tracer("github.com/mcoldibelli/nupii/backend/internal/platform/postgres")}
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("create connection pool: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}
	return pool, nil
}

// Migrate applies to the database of pool the migrations of files that are
// not applied yet. Migrate does nothing when all of them are applied.
func Migrate(ctx context.Context, pool *pgxpool.Pool, files fs.FS) (err error) {
	// goose uses database/sql. This handle uses the connections of pool,
	// and its Close does not close pool.
	db := stdlib.OpenDBFromPool(pool)
	defer func() {
		if cerr := db.Close(); cerr != nil && err == nil {
			err = fmt.Errorf("close migration handle: %w", cerr)
		}
	}()

	provider, err := goose.NewProvider(goose.DialectPostgres, db, files)
	if err != nil {
		return fmt.Errorf("read migrations: %w", err)
	}
	if _, err := provider.Up(ctx); err != nil {
		return fmt.Errorf("apply migrations: %w", err)
	}
	return nil
}
