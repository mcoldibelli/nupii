//go:build integration

package postgres_test

import (
	"testing"

	"github.com/mcoldibelli/nupii/backend/internal/platform/postgres/postgrestest"
)

// #303: the views of the schema metrics exist and can be read. Grafana reads
// only these views, with the role of deploy/postgres/metrics-reader.sql.
func TestTheMetricsViewsCanBeRead(t *testing.T) {
	pool := postgrestest.Open(t)
	ctx := t.Context()

	var owners, pets int64
	if err := pool.QueryRow(ctx, "SELECT owners, pets FROM metrics.totals").Scan(&owners, &pets); err != nil {
		t.Fatalf("read metrics.totals: %v", err)
	}
	if owners < 0 || pets < 0 {
		t.Errorf("totals = %d owners and %d pets, want counts", owners, pets)
	}
	for _, view := range []string{
		"metrics.noseprints_by_version",
		"metrics.signups_daily",
		"metrics.identifications_daily",
		"metrics.reports_daily",
		"metrics.notifications_daily",
		"metrics.jobs",
	} {
		rows, err := pool.Query(ctx, "SELECT * FROM "+view)
		if err != nil {
			t.Fatalf("read %s: %v", view, err)
		}
		for rows.Next() {
		}
		if err := rows.Err(); err != nil {
			t.Errorf("read the rows of %s: %v", view, err)
		}
		rows.Close()
	}
}
