// Package jobs is the queue of background jobs in the database (ADR 0003).
//
// A job is written in the same transaction as the data that causes it
// (RNF-01). A runner takes one due job with FOR UPDATE SKIP LOCKED and runs
// its handler in the same transaction, so the writes of the handler and
// the end of the job are saved together, or not at all.
package jobs

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	// RNF-02: depois de 5 tentativas, a tarefa fica marcada como falha.
	_maxAttempts = 5
	// RNF-02: a espera depois da primeira falha é de 10 s, e dobra a cada falha.
	_firstRetryDelay = 10 * time.Second
	// _pollInterval is the time a runner waits when no job is due.
	_pollInterval = time.Second
	// _jobTimeout is the time one job has.
	_jobTimeout = time.Minute
)

// Handler runs one job. tx is the transaction of the job: the writes of the
// handler are saved only when it returns nil. A handler must be safe to run
// two times (RNF-02).
type Handler func(ctx context.Context, tx pgx.Tx, payload json.RawMessage) error

// Enqueue writes a job of kind with payload as JSON, in tx. The job exists
// only when tx commits.
func Enqueue(ctx context.Context, tx pgx.Tx, kind string, payload any) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("encode the payload of the %s job: %w", kind, err)
	}
	const insert = "INSERT INTO jobs (kind, payload) VALUES ($1, $2)"
	if _, err := tx.Exec(ctx, insert, kind, data); err != nil {
		return fmt.Errorf("enqueue the %s job: %w", kind, err)
	}
	return nil
}

// Execer runs a statement. pgx.Tx and *pgxpool.Pool implement it.
type Execer interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

// EnqueueAt writes a job of kind with payload as JSON, due at runAt. A job
// that a unique index already has changes nothing.
func EnqueueAt(ctx context.Context, db Execer, kind string, payload any, runAt time.Time) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("encode the payload of the %s job: %w", kind, err)
	}
	const insert = `INSERT INTO jobs (kind, payload, run_at) VALUES ($1, $2, $3)
		ON CONFLICT DO NOTHING`
	if _, err := db.Exec(ctx, insert, kind, data, runAt); err != nil {
		return fmt.Errorf("enqueue the %s job at %s: %w", kind, runAt, err)
	}
	return nil
}

// Runner runs the jobs of the kinds that it has a handler for.
type Runner struct {
	pool     *pgxpool.Pool
	logger   *slog.Logger
	handlers map[string]Handler
	kinds    []string
}

// NewRunner returns a runner of the jobs in the database of pool, with one
// handler for each kind. A job of another kind is left for another runner.
func NewRunner(pool *pgxpool.Pool, logger *slog.Logger, handlers map[string]Handler) *Runner {
	kinds := make([]string, 0, len(handlers))
	for kind := range handlers {
		kinds = append(kinds, kind)
	}
	return &Runner{pool: pool, logger: logger, handlers: handlers, kinds: kinds}
}

// Run runs the due jobs until ctx is cancelled. It ends the job in
// progress before it returns: the job gets a context that the cancel of
// ctx does not stop. The caller cancels ctx and waits for Run to return.
func (r *Runner) Run(ctx context.Context) {
	for {
		worked, err := r.Work(context.WithoutCancel(ctx))
		if err != nil {
			r.logger.ErrorContext(ctx, "run a job", slog.Any("error", err))
		}
		if worked && err == nil {
			// More jobs can be due: look again at once.
			if ctx.Err() != nil {
				return
			}
			continue
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(_pollInterval):
		}
	}
}

// Work runs one due job, when there is one. worked is false when no job
// is due. An error of the handler is not an error of Work: the job waits
// for its next attempt. Work returns an error when the database fails.
func (r *Runner) Work(ctx context.Context) (worked bool, err error) {
	ctx, cancel := context.WithTimeout(ctx, _jobTimeout)
	defer cancel()
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return false, fmt.Errorf("begin the job transaction: %w", err)
	}
	defer func() {
		// After Commit, Rollback returns pgx.ErrTxClosed and does nothing.
		rerr := tx.Rollback(context.WithoutCancel(ctx))
		if rerr != nil && !errors.Is(rerr, pgx.ErrTxClosed) && err == nil {
			err = fmt.Errorf("roll back the job transaction: %w", rerr)
		}
	}()

	var (
		id       string
		kind     string
		payload  json.RawMessage
		attempts int
	)
	const take = `SELECT id, kind, payload, attempts FROM jobs
		WHERE status = 'pending' AND run_at <= now() AND kind = ANY($1)
		ORDER BY run_at
		LIMIT 1
		FOR UPDATE SKIP LOCKED`
	err = tx.QueryRow(ctx, take, r.kinds).Scan(&id, &kind, &payload, &attempts)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("take a job: %w", err)
	}
	attempts++

	// The writes of the handler are in a savepoint: a failure rolls them
	// back, and the transaction still saves the new state of the job.
	jobErr := r.runHandler(ctx, tx, kind, payload)
	if jobErr == nil {
		const finish = `UPDATE jobs SET status = 'done', attempts = $2, last_error = NULL,
			updated_at = now() WHERE id = $1`
		if _, err := tx.Exec(ctx, finish, id, attempts); err != nil {
			return true, fmt.Errorf("finish the %s job %s: %w", kind, id, err)
		}
	} else {
		state, level := "pending", slog.LevelWarn
		if attempts >= _maxAttempts {
			// The job does not run again: this needs a person.
			state, level = "failed", slog.LevelError
		}
		r.logger.Log(ctx, level, "job failed",
			slog.String("job_id", id), slog.String("kind", kind), slog.Int("attempt", attempts),
			slog.String("state", state), slog.Any("error", jobErr))
		// RNF-02: 10 s, 20 s, 40 s e 80 s.
		delay := _firstRetryDelay << (attempts - 1)
		const retry = `UPDATE jobs SET status = $2, attempts = $3, last_error = $4,
			run_at = now() + $5::interval, updated_at = now() WHERE id = $1`
		_, err := tx.Exec(ctx, retry, id, state, attempts, jobErr.Error(), delay.String())
		if err != nil {
			return true, fmt.Errorf("retry the %s job %s: %w", kind, id, err)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return true, fmt.Errorf("commit the %s job %s: %w", kind, id, err)
	}
	return true, nil
}

func (r *Runner) runHandler(
	ctx context.Context,
	tx pgx.Tx,
	kind string,
	payload json.RawMessage,
) (err error) {
	// A panic of a handler is a failure of the job, and not of the API.
	defer func() {
		if value := recover(); value != nil {
			err = fmt.Errorf("the %s job panicked: %v", kind, value)
		}
	}()
	savepoint, err := tx.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin the savepoint of the job: %w", err)
	}
	if err := r.handlers[kind](ctx, savepoint, payload); err != nil {
		if rerr := savepoint.Rollback(ctx); rerr != nil {
			return fmt.Errorf("%w (and roll back the savepoint: %w)", err, rerr)
		}
		return err
	}
	if err := savepoint.Commit(ctx); err != nil {
		return fmt.Errorf("release the savepoint of the job: %w", err)
	}
	return nil
}
