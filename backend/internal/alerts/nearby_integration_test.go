//go:build integration

package alerts

import (
	"context"
	"crypto/rand"
	"fmt"
	"testing"

	"github.com/mcoldibelli/nupii/backend/internal/alerts/alertsdb"
	"github.com/mcoldibelli/nupii/backend/internal/platform/postgres/postgrestest"
)

// RN-33: o alerta vai para no máximo 100 tutores, os mais próximos.
func TestNearbyOwnersAreAtMost100AndTheNearest(t *testing.T) {
	pool := postgrestest.Open(t)
	ctx := t.Context()
	prefix := "nearby-" + rand.Text() + "-"
	t.Cleanup(func() {
		ctx := context.WithoutCancel(ctx)
		const owners = "SELECT id FROM owners WHERE firebase_uid LIKE $1"
		if _, err := pool.Exec(ctx, "DELETE FROM owner_locations WHERE owner_id IN ("+owners+")", prefix+"%"); err != nil {
			t.Errorf("clean the locations: %v", err)
		}
		if _, err := pool.Exec(ctx, "DELETE FROM owners WHERE firebase_uid LIKE $1", prefix+"%"); err != nil {
			t.Errorf("clean the owners: %v", err)
		}
	})
	// 105 owners on a line to the north, 10 m apart, from 10 m to 1.050 m.
	// The center of the test is a point that no other test uses.
	const latitude, longitude = -10.0, -50.0
	var author string
	for i := range 105 {
		var id string
		const create = `INSERT INTO owners (firebase_uid, email, name, terms_version, terms_accepted_at)
			VALUES ($1, 'n@example.com', 'Nearby', '2026-11-10', now()) RETURNING id`
		if err := pool.QueryRow(ctx, create, fmt.Sprintf("%s%d", prefix, i)).Scan(&id); err != nil {
			t.Fatalf("create owner %d: %v", i, err)
		}
		// 10 m is about 0,00009 degree of latitude.
		err := alertsdb.New(pool).SetOwnerLocation(ctx, alertsdb.SetOwnerLocationParams{
			OwnerID: id, Latitude: latitude + 0.00009*float64(i+1), Longitude: longitude,
		})
		if err != nil {
			t.Fatalf("set location %d: %v", i, err)
		}
		if i == 0 {
			author = id
		}
	}

	owners, err := alertsdb.New(pool).ListNearbyOwners(ctx, alertsdb.ListNearbyOwnersParams{
		Latitude: latitude, Longitude: longitude, RadiusM: _alertRadiusMeters,
		AuthorID: author, MaxOwners: _maxAlertedOwners,
	})
	if err != nil {
		t.Fatalf("ListNearbyOwners: %v", err)
	}
	// RN-34: sem o autor, the nearest one. RN-33: 100 of the 104 others.
	if len(owners) != 100 {
		t.Fatalf("%d owners, want 100", len(owners))
	}
	for i, owner := range owners {
		if owner.OwnerID == author {
			t.Fatal("the author is in the list")
		}
		if i > 0 && owner.DistanceM < owners[i-1].DistanceM {
			t.Fatalf("owner %d is nearer than owner %d", i, i-1)
		}
	}
	if owners[0].DistanceM < 15 || owners[0].DistanceM > 25 || owners[99].DistanceM > 1015 {
		t.Errorf("distances from %.0f to %.0f m, want from about 20 m to about 1.010 m",
			owners[0].DistanceM, owners[99].DistanceM)
	}
}
