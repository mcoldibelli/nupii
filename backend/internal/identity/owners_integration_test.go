//go:build integration

package identity_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/mcoldibelli/nupii/backend/internal/identity/identitydb"
	"github.com/mcoldibelli/nupii/backend/internal/platform/postgres/postgrestest"
)

// queriesInTx returns the queries of the module in a transaction that is
// rolled back when the test ends, so the test leaves no row in the database.
func queriesInTx(t *testing.T) *identitydb.Queries {
	t.Helper()
	pool := postgrestest.Open(t)
	tx, err := pool.Begin(t.Context())
	if err != nil {
		t.Fatalf("begin transaction: %v", err)
	}
	t.Cleanup(func() {
		err := tx.Rollback(context.WithoutCancel(t.Context()))
		if err != nil && !errors.Is(err, pgx.ErrTxClosed) {
			t.Errorf("roll back transaction: %v", err)
		}
	})
	return identitydb.New(tx)
}

func TestCreateOwnerAndGetOwnerByFirebaseUID(t *testing.T) {
	ctx := t.Context()
	queries := queriesInTx(t)
	// RN-01: the date and the version of the accepted terms are stored.
	acceptedAt := time.Date(2026, 11, 10, 12, 30, 0, 0, time.UTC)
	params := identitydb.CreateOwnerParams{
		FirebaseUID:     "uid-of-the-test",
		Email:           "tutor@example.com",
		Name:            "Ana",
		TermsVersion:    "2026-11-10",
		TermsAcceptedAt: acceptedAt,
	}

	created, err := queries.CreateOwner(ctx, params)
	if err != nil {
		t.Fatalf("CreateOwner: %v", err)
	}
	if len(created.ID) != 36 {
		t.Errorf("ID = %q, want a UUID in text form", created.ID)
	}
	if created.CreatedAt.IsZero() {
		t.Error("CreatedAt is zero, want the time of the insert")
	}

	got, err := queries.GetOwnerByFirebaseUID(ctx, params.FirebaseUID)
	if err != nil {
		t.Fatalf("GetOwnerByFirebaseUID: %v", err)
	}
	if got.ID != created.ID || got.Email != params.Email || got.Name != params.Name ||
		got.TermsVersion != params.TermsVersion || !got.TermsAcceptedAt.Equal(acceptedAt) {
		t.Errorf("owner read = %+v, want the owner created from %+v", got, params)
	}
}

func TestCreateOwnerDoesNotChangeAnExistingOwner(t *testing.T) {
	ctx := t.Context()
	queries := queriesInTx(t)
	first := identitydb.CreateOwnerParams{
		FirebaseUID:     "uid-of-the-test",
		Email:           "tutor@example.com",
		Name:            "Ana",
		TermsVersion:    "2026-11-10",
		TermsAcceptedAt: time.Date(2026, 11, 10, 12, 30, 0, 0, time.UTC),
	}
	if _, err := queries.CreateOwner(ctx, first); err != nil {
		t.Fatalf("CreateOwner, first call: %v", err)
	}
	second := first
	second.Name = "Other name"

	_, err := queries.CreateOwner(ctx, second)

	if !errors.Is(err, pgx.ErrNoRows) {
		t.Fatalf("CreateOwner with the same firebase_uid: error = %v, want pgx.ErrNoRows", err)
	}
	got, err := queries.GetOwnerByFirebaseUID(ctx, first.FirebaseUID)
	if err != nil {
		t.Fatalf("GetOwnerByFirebaseUID: %v", err)
	}
	if got.Name != first.Name {
		t.Errorf("Name = %q, want %q: the second call must change nothing", got.Name, first.Name)
	}
}

func TestGetOwnerByFirebaseUIDWithUnknownUID(t *testing.T) {
	queries := queriesInTx(t)

	_, err := queries.GetOwnerByFirebaseUID(t.Context(), "uid-that-does-not-exist")

	if !errors.Is(err, pgx.ErrNoRows) {
		t.Errorf("error = %v, want pgx.ErrNoRows", err)
	}
}
