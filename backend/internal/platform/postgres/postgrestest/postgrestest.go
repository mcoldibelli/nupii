// Package postgrestest gives the integration tests the database of the
// local environment.
package postgrestest

import (
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mcoldibelli/nupii/backend/db/migrations"
	"github.com/mcoldibelli/nupii/backend/internal/platform/postgres"
)

// URL returns the connection URL of the database, from DATABASE_URL.
// An integration test without a database fails. It is not skipped.
func URL(t testing.TB) string {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Fatal("DATABASE_URL is not set: start the compose and set the variable " +
			"(see backend/README.md)")
	}
	return url
}

// Open returns a connection pool for the database, with all the migrations
// applied. The pool is closed when the test ends.
func Open(t testing.TB) *pgxpool.Pool {
	t.Helper()
	pool, err := postgres.Open(t.Context(), URL(t))
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	t.Cleanup(pool.Close)
	if err := postgres.Migrate(t.Context(), pool, migrations.FS); err != nil {
		t.Fatalf("migrate database: %v", err)
	}
	return pool
}
