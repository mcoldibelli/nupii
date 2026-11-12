// Package postgrestest gives the integration tests their own database, next
// to the database of the local environment.
package postgrestest

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"os"
	"strings"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mcoldibelli/nupii/backend/db/migrations"
	"github.com/mcoldibelli/nupii/backend/internal/platform/postgres"
)

// _duplicateDatabase is the SQLSTATE of CREATE DATABASE for a database that
// exists. The test packages run at the same time, so two of them can create it.
const _duplicateDatabase = "42P04"

var (
	_testURL   string
	_testErr   error
	_setupOnce sync.Once
)

// URL returns the connection URL of the test database: the database of
// DATABASE_URL with the suffix "_test". The first call creates it when it
// does not exist. The tests do not write in the database of the local
// environment (issue #204). An integration test without a database fails.
// It is not skipped.
func URL(t testing.TB) string {
	t.Helper()
	main := os.Getenv("DATABASE_URL")
	if main == "" {
		t.Fatal("DATABASE_URL is not set: start the compose and set the variable " +
			"(see backend/README.md)")
	}
	_setupOnce.Do(func() { _testURL, _testErr = testDatabase(context.Background(), main) })
	if _testErr != nil {
		t.Fatalf("prepare the test database: %v", _testErr)
	}
	return _testURL
}

// testDatabase creates the test database of the database of mainURL when it
// does not exist, and returns its URL.
func testDatabase(ctx context.Context, mainURL string) (string, error) {
	parsed, err := url.Parse(mainURL)
	if err != nil {
		return "", fmt.Errorf("parse DATABASE_URL: %w", err)
	}
	name := strings.TrimSuffix(strings.TrimPrefix(parsed.Path, "/"), "_test") + "_test"
	conn, err := pgx.Connect(ctx, mainURL)
	if err != nil {
		return "", fmt.Errorf("connect to the database of DATABASE_URL: %w", err)
	}
	defer conn.Close(ctx)
	var exists bool
	const query = "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1)"
	if err := conn.QueryRow(ctx, query, name).Scan(&exists); err != nil {
		return "", fmt.Errorf("look for the database %s: %w", name, err)
	}
	if !exists {
		_, err := conn.Exec(ctx, "CREATE DATABASE "+pgx.Identifier{name}.Sanitize())
		var pgErr *pgconn.PgError
		if err != nil && !(errors.As(err, &pgErr) && pgErr.Code == _duplicateDatabase) {
			return "", fmt.Errorf("create the database %s: %w", name, err)
		}
	}
	parsed.Path = "/" + name
	return parsed.String(), nil
}

// Open returns a connection pool for the test database, with all the
// migrations applied. The pool is closed when the test ends.
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
