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
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mcoldibelli/nupii/backend/db/migrations"
	"github.com/mcoldibelli/nupii/backend/internal/platform/postgres"
)

// _setupLock is the key of the advisory lock that puts the setup of the test
// database in sequence. The test packages run at the same time: two of them
// that create or migrate a new database together fail.
const _setupLock = 20480204

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

// testDatabase creates and migrates the test database of the database of
// mainURL, under an advisory lock in that database, and returns its URL.
func testDatabase(ctx context.Context, mainURL string) (testURL string, err error) {
	parsed, err := url.Parse(mainURL)
	if err != nil {
		return "", fmt.Errorf("parse DATABASE_URL: %w", err)
	}
	name := strings.TrimSuffix(strings.TrimPrefix(parsed.Path, "/"), "_test") + "_test"
	parsed.Path = "/" + name
	conn, err := pgx.Connect(ctx, mainURL)
	if err != nil {
		return "", fmt.Errorf("connect to the database of DATABASE_URL: %w", err)
	}
	// Closing the session also ends the lock.
	defer func() {
		if closeErr := conn.Close(context.WithoutCancel(ctx)); closeErr != nil {
			err = errors.Join(err, fmt.Errorf("close the setup connection: %w", closeErr))
		}
	}()
	if _, err := conn.Exec(ctx, "SELECT pg_advisory_lock($1)", _setupLock); err != nil {
		return "", fmt.Errorf("lock the setup of the test database: %w", err)
	}
	var exists bool
	const query = "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1)"
	if err := conn.QueryRow(ctx, query, name).Scan(&exists); err != nil {
		return "", fmt.Errorf("look for the database %s: %w", name, err)
	}
	if !exists {
		create := "CREATE DATABASE " + pgx.Identifier{name}.Sanitize()
		if _, err := conn.Exec(ctx, create); err != nil {
			return "", fmt.Errorf("create the database %s: %w", name, err)
		}
	}
	pool, err := postgres.Open(ctx, parsed.String())
	if err != nil {
		return "", fmt.Errorf("open the test database: %w", err)
	}
	defer pool.Close()
	if err := postgres.Migrate(ctx, pool, migrations.FS); err != nil {
		return "", fmt.Errorf("migrate the test database: %w", err)
	}
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
