//go:build integration

package jobs_test

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"log/slog"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mcoldibelli/nupii/backend/internal/platform/jobs"
	"github.com/mcoldibelli/nupii/backend/internal/platform/postgres/postgrestest"
)

// newKind returns a kind of job that only this test uses, so the jobs of
// other tests in the same database do not mix with it.
func newKind(t *testing.T, pool *pgxpool.Pool) string {
	t.Helper()
	kind := "test_" + rand.Text()
	t.Cleanup(func() {
		ctx := context.WithoutCancel(t.Context())
		if _, err := pool.Exec(ctx, "DELETE FROM jobs WHERE kind = $1", kind); err != nil {
			t.Errorf("delete the jobs of the test: %v", err)
		}
	})
	return kind
}

func enqueue(t *testing.T, pool *pgxpool.Pool, kind string, payload any) {
	t.Helper()
	tx, err := pool.Begin(t.Context())
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	if err := jobs.Enqueue(t.Context(), tx, kind, payload); err != nil {
		t.Fatalf("Enqueue: %v", err)
	}
	if err := tx.Commit(t.Context()); err != nil {
		t.Fatalf("commit: %v", err)
	}
}

func status(t *testing.T, pool *pgxpool.Pool, kind string) (state string, attempts int, wait time.Duration) {
	t.Helper()
	const query = "SELECT status, attempts, run_at - now() FROM jobs WHERE kind = $1"
	if err := pool.QueryRow(t.Context(), query, kind).Scan(&state, &attempts, &wait); err != nil {
		t.Fatalf("read the job: %v", err)
	}
	return state, attempts, wait
}

func newRunner(pool *pgxpool.Pool, kind string, handler jobs.Handler) *jobs.Runner {
	return jobs.NewRunner(pool, slog.New(slog.DiscardHandler), map[string]jobs.Handler{kind: handler})
}

type payload struct {
	Name string `json:"name"`
}

func TestAJobRunsOnceWithItsPayload(t *testing.T) {
	pool := postgrestest.Open(t)
	kind := newKind(t, pool)
	enqueue(t, pool, kind, payload{Name: "Rex"})
	var got []string
	runner := newRunner(pool, kind, func(_ context.Context, _ pgx.Tx, raw json.RawMessage) error {
		var p payload
		if err := json.Unmarshal(raw, &p); err != nil {
			return err
		}
		got = append(got, p.Name)
		return nil
	})

	for range 2 {
		if _, err := runner.Work(t.Context()); err != nil {
			t.Fatalf("Work: %v", err)
		}
	}

	if len(got) != 1 || got[0] != "Rex" {
		t.Errorf("the handler got %v, want one call with Rex", got)
	}
	if state, attempts, _ := status(t, pool, kind); state != "done" || attempts != 1 {
		t.Errorf("job = %s with %d attempts, want done with 1", state, attempts)
	}
}

// RNF-01: a tarefa é gravada na mesma transação do dado que a causa.
func TestAJobOfATransactionThatRollsBackDoesNotExist(t *testing.T) {
	pool := postgrestest.Open(t)
	kind := newKind(t, pool)
	tx, err := pool.Begin(t.Context())
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	if err := jobs.Enqueue(t.Context(), tx, kind, payload{}); err != nil {
		t.Fatalf("Enqueue: %v", err)
	}
	if err := tx.Rollback(t.Context()); err != nil {
		t.Fatalf("rollback: %v", err)
	}

	worked, err := newRunner(pool, kind, func(context.Context, pgx.Tx, json.RawMessage) error {
		t.Error("the handler ran a job of a transaction that rolled back")
		return nil
	}).Work(t.Context())
	if err != nil || worked {
		t.Errorf("Work = %t, %v, want no job", worked, err)
	}
}

// RNF-02: uma tarefa que falha é tentada de novo, com espera crescente:
// 10 s, 20 s, 40 s e 80 s. Depois de 5 tentativas, a tarefa fica marcada
// como falha.
func TestAFailedJobWaitsMoreEachTimeAndFailsAfter5Attempts(t *testing.T) {
	pool := postgrestest.Open(t)
	kind := newKind(t, pool)
	enqueue(t, pool, kind, payload{})
	runner := newRunner(pool, kind, func(ctx context.Context, tx pgx.Tx, _ json.RawMessage) error {
		// This write is rolled back with the failure of the job.
		if _, err := tx.Exec(ctx, "UPDATE jobs SET last_error = 'written by the handler' WHERE kind = $1", kind); err != nil {
			return err
		}
		return errors.New("the job failed")
	})

	for i, want := range []time.Duration{10 * time.Second, 20 * time.Second, 40 * time.Second, 80 * time.Second} {
		if _, err := runner.Work(t.Context()); err != nil {
			t.Fatalf("Work: %v", err)
		}
		state, attempts, wait := status(t, pool, kind)
		if state != "pending" || attempts != i+1 || wait < want-2*time.Second || wait > want {
			t.Fatalf("after attempt %d: %s, %d attempts, wait %v, want pending and a wait of %v",
				i+1, state, attempts, wait, want)
		}
		// The test does not wait: the job is due now.
		if _, err := pool.Exec(t.Context(), "UPDATE jobs SET run_at = now() WHERE kind = $1", kind); err != nil {
			t.Fatalf("make the job due: %v", err)
		}
	}
	if _, err := runner.Work(t.Context()); err != nil {
		t.Fatalf("Work: %v", err)
	}
	if state, attempts, _ := status(t, pool, kind); state != "failed" || attempts != 5 {
		t.Errorf("after 5 attempts: %s with %d attempts, want failed", state, attempts)
	}
	var lastError string
	if err := pool.QueryRow(t.Context(), "SELECT last_error FROM jobs WHERE kind = $1", kind).Scan(&lastError); err != nil {
		t.Fatalf("read the error: %v", err)
	}
	if lastError != "the job failed" {
		t.Errorf("last_error = %q, want the error of the handler, and not its rolled back write", lastError)
	}
}

// Two runners at the same time run each job one time (SKIP LOCKED).
func TestRunnersAtTheSameTimeRunEachJobOnce(t *testing.T) {
	pool := postgrestest.Open(t)
	kind := newKind(t, pool)
	const count = 20
	for range count {
		enqueue(t, pool, kind, payload{})
	}
	var calls atomic.Int32
	handler := func(context.Context, pgx.Tx, json.RawMessage) error {
		calls.Add(1)
		time.Sleep(5 * time.Millisecond)
		return nil
	}
	var group sync.WaitGroup
	for range 4 {
		runner := newRunner(pool, kind, handler)
		group.Go(func() {
			for {
				worked, err := runner.Work(t.Context())
				if err != nil {
					t.Errorf("Work: %v", err)
					return
				}
				if !worked {
					return
				}
			}
		})
	}
	group.Wait()

	if calls.Load() != count {
		t.Errorf("%d calls of the handler, want %d", calls.Load(), count)
	}
}

// RNF-01: uma tarefa gravada com os workers parados é executada quando
// eles sobem. Run stops when the context is cancelled.
func TestRunRunsTheJobsThatWaitAndStopsWithTheContext(t *testing.T) {
	pool := postgrestest.Open(t)
	kind := newKind(t, pool)
	enqueue(t, pool, kind, payload{Name: "before the start"})
	done := make(chan string, 1)
	runner := newRunner(pool, kind, func(_ context.Context, _ pgx.Tx, raw json.RawMessage) error {
		var p payload
		if err := json.Unmarshal(raw, &p); err != nil {
			return err
		}
		done <- p.Name
		return nil
	})
	ctx, cancel := context.WithCancel(t.Context())
	stopped := make(chan struct{})
	go func() {
		runner.Run(ctx)
		close(stopped)
	}()

	select {
	case name := <-done:
		if name != "before the start" {
			t.Errorf("the job has %q", name)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("the job did not run in 10 seconds")
	}
	cancel()
	select {
	case <-stopped:
	case <-time.After(10 * time.Second):
		t.Fatal("Run did not stop 10 seconds after the cancel")
	}
}
