//go:build integration

package jobs_test

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/jackc/pgx/v5"

	"github.com/mcoldibelli/nupii/backend/internal/platform/postgres/postgrestest"
)

// A panic of a handler is a failure of the job: Work returns, and the job
// waits for its next attempt.
func TestAPanicOfAHandlerIsAFailureOfTheJob(t *testing.T) {
	pool := postgrestest.Open(t)
	kind := newKind(t, pool)
	enqueue(t, pool, kind, payload{})

	worked, err := newRunner(pool, kind, func(context.Context, pgx.Tx, json.RawMessage) error {
		panic("the handler failed")
	}).Work(t.Context())

	if !worked || err != nil {
		t.Fatalf("Work = %t, %v, want a job and no error", worked, err)
	}
	if state, attempts, _ := status(t, pool, kind); state != "pending" || attempts != 1 {
		t.Errorf("job = %s with %d attempts, want pending with 1", state, attempts)
	}
}
