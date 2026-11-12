//go:build integration

package postgrestest_test

import (
	"net/url"
	"os"
	"strings"
	"testing"

	"github.com/mcoldibelli/nupii/backend/internal/platform/postgres/postgrestest"
)

// The integration tests use their own database, not the database of the
// local environment (issue #204).
func TestURLUsesTheTestDatabase(t *testing.T) {
	main, err := url.Parse(os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatalf("parse DATABASE_URL: %v", err)
	}
	pool := postgrestest.Open(t)

	var name string
	if err := pool.QueryRow(t.Context(), "SELECT current_database()").Scan(&name); err != nil {
		t.Fatalf("read the database name: %v", err)
	}
	if want := strings.TrimSuffix(strings.TrimPrefix(main.Path, "/"), "_test") + "_test"; name != want {
		t.Errorf("the tests use the database %q, want %q", name, want)
	}
}
