//go:build integration

package postgres_test

import (
	"os"
	"testing"

	"github.com/mcoldibelli/nupii/backend/db/migrations"
	"github.com/mcoldibelli/nupii/backend/internal/platform/postgres"
)

// An integration test without a database fails. It is not skipped.
func databaseURL(t *testing.T) string {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Fatal("DATABASE_URL is not set: start the compose and set the variable (see backend/README.md)")
	}
	return url
}

func TestMigrateCreatesTheExtensionsAndCanRunAgain(t *testing.T) {
	ctx := t.Context()
	pool, err := postgres.Open(ctx, databaseURL(t))
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer pool.Close()

	for run := 1; run <= 2; run++ {
		if err := postgres.Migrate(ctx, pool, migrations.FS); err != nil {
			t.Fatalf("Migrate, run %d: %v", run, err)
		}
	}

	rows, err := pool.Query(ctx, "SELECT extname FROM pg_extension WHERE extname IN ('postgis', 'vector') ORDER BY extname")
	if err != nil {
		t.Fatalf("query extensions: %v", err)
	}
	defer rows.Close()
	var got []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			t.Fatalf("scan extension name: %v", err)
		}
		got = append(got, name)
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("read extensions: %v", err)
	}
	if len(got) != 2 || got[0] != "postgis" || got[1] != "vector" {
		t.Errorf("extensions = %v, want [postgis vector]", got)
	}

	// The two extensions work: one distance and one cosine similarity.
	var meters, similarity float64
	query := `SELECT
		ST_Distance(ST_SetSRID(ST_MakePoint(-46.6333, -23.5505), 4326)::geography,
		            ST_SetSRID(ST_MakePoint(-46.6333, -23.5415), 4326)::geography)::float8,
		(1 - ('[1,0,0]'::vector <=> '[1,1,0]'::vector))::float8`
	if err := pool.QueryRow(ctx, query).Scan(&meters, &similarity); err != nil {
		t.Fatalf("query with the extensions: %v", err)
	}
	if meters < 990 || meters > 1005 {
		t.Errorf("distance = %.1f m, want about 997 m", meters)
	}
	if similarity < 0.7070 || similarity > 0.7072 {
		t.Errorf("cosine similarity = %.4f, want 0.7071", similarity)
	}
}

func TestOpenFailsWhenTheDatabaseDoesNotRespond(t *testing.T) {
	// Port 1 has no server.
	pool, err := postgres.Open(t.Context(), "postgres://user:password@127.0.0.1:1/database?sslmode=disable")
	if err == nil {
		pool.Close()
		t.Fatal("Open without a database: got nil error, want an error")
	}
}
