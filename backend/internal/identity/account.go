package identity

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mcoldibelli/nupii/backend/internal/identity/identitydb"
	"github.com/mcoldibelli/nupii/backend/internal/platform/jobs"
	"github.com/mcoldibelli/nupii/backend/internal/platform/storage"
)

const (
	// _jobDeleteUser deletes the user of a deleted account in the identity
	// provider (RN-03), and passes the erasers again (RN-84).
	_jobDeleteUser = "delete_identity_user"
	// _secondPassDelay is the wait before the job. A request that was in
	// progress during the delete ends before it: the write timeout of the
	// server is 3 minutes.
	_secondPassDelay = 5 * time.Minute
)

// Eraser erases the data of an owner that a module keeps, in tx (RN-84).
// It returns the keys of the stored objects that the commit makes unused.
type Eraser interface {
	EraseOwner(ctx context.Context, tx pgx.Tx, ownerID string) (keys []string, err error)
}

// ObjectStore deletes a stored object. *storage.Store implements it.
type ObjectStore interface {
	Delete(ctx context.Context, key string) error
}

// UserDeleter deletes a user in the identity provider. A user that does not
// exist counts as deleted.
type UserDeleter interface {
	DeleteUser(ctx context.Context, uid string) error
}

// Accounts deletes accounts (RF-08).
type Accounts struct {
	pool    *pgxpool.Pool
	objects ObjectStore
	logger  *slog.Logger
	erasers []Eraser
}

// NewAccounts returns the accounts of the database of pool. erasers are the
// modules that keep data of an owner.
func NewAccounts(
	pool *pgxpool.Pool,
	objects ObjectStore,
	logger *slog.Logger,
	erasers ...Eraser,
) *Accounts {
	return &Accounts{pool: pool, objects: objects, logger: logger, erasers: erasers}
}

type deleteUserPayload struct {
	UID     string `json:"uid"`
	OwnerID string `json:"ownerId"`
}

// erase passes the erasers in tx and returns the keys of the objects.
func (a *Accounts) erase(ctx context.Context, tx pgx.Tx, ownerID string) ([]string, error) {
	var keys []string
	for _, eraser := range a.erasers {
		erased, err := eraser.EraseOwner(ctx, tx, ownerID)
		if err != nil {
			return nil, fmt.Errorf("erase the data of the owner: %w", err)
		}
		keys = append(keys, erased...)
	}
	return keys, nil
}

// Delete deletes the account that made the request: each module erases its
// data, the owner is anonymized, and a job deletes the user in the identity
// provider, all in one transaction (RN-03, RN-84). The stored objects are
// deleted after the commit.
func (a *Accounts) Delete(ctx context.Context) error {
	who, ok := FromContext(ctx)
	if !ok {
		return ErrNoIdentity
	}
	tx, err := a.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin the delete of the account: %w", err)
	}
	defer func() {
		if err := tx.Rollback(ctx); err != nil && !errors.Is(err, pgx.ErrTxClosed) {
			a.logger.ErrorContext(ctx, "roll back the delete of the account",
				slog.Any("error", err))
		}
	}()
	queries := identitydb.New(tx)
	ownerID, err := queries.LockOwner(ctx, who.UID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrOwnerNotFound
	}
	if err != nil {
		return fmt.Errorf("lock the owner: %w", err)
	}
	keys, err := a.erase(ctx, tx, ownerID)
	if err != nil {
		return err
	}
	if err := queries.AnonymizeOwner(ctx, ownerID); err != nil {
		return fmt.Errorf("anonymize the owner: %w", err)
	}
	payload := deleteUserPayload{UID: who.UID, OwnerID: ownerID}
	runAt := time.Now().Add(_secondPassDelay)
	if err := jobs.EnqueueAt(ctx, tx, _jobDeleteUser, payload, runAt); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit the delete of the account: %w", err)
	}
	a.logger.InfoContext(ctx, "account deleted",
		slog.String("owner_id", ownerID), slog.Int("objects", len(keys)))
	for _, key := range keys {
		// The data is already deleted: a failure stays in the log.
		if err := a.objects.Delete(context.WithoutCancel(ctx), key); err != nil {
			a.logger.ErrorContext(ctx, "delete an object of a deleted account",
				slog.String("key", key), slog.Any("error", err))
		}
	}
	return nil
}

// JobHandlers returns the jobs of identity, with users as the identity
// provider.
func (a *Accounts) JobHandlers(users UserDeleter) map[string]jobs.Handler {
	return map[string]jobs.Handler{
		_jobDeleteUser: func(ctx context.Context, tx pgx.Tx, payload json.RawMessage) error {
			var job deleteUserPayload
			if err := json.Unmarshal(payload, &job); err != nil {
				return fmt.Errorf("decode the payload: %w", err)
			}
			// RN-84: a write that was in progress during the delete ended
			// after the commit. The second pass erases it.
			keys, err := a.erase(ctx, tx, job.OwnerID)
			if err != nil {
				return err
			}
			if err := storage.EnqueueDelete(ctx, tx, keys); err != nil {
				return err
			}
			if err := users.DeleteUser(ctx, job.UID); err != nil {
				return fmt.Errorf("delete the user of a deleted account: %w", err)
			}
			return nil
		},
	}
}
