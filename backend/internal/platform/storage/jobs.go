package storage

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/jackc/pgx/v5"

	"github.com/mcoldibelli/nupii/backend/internal/platform/jobs"
)

// _jobDeleteObjects deletes stored objects after the commit of the
// transaction that made them unused.
const _jobDeleteObjects = "delete_stored_objects"

type deleteObjectsPayload struct {
	Keys []string `json:"keys"`
}

// EnqueueDelete writes, in tx, a job that deletes the objects keys. The job
// runs after the commit, so a transaction that locks rows does not call
// the store. It writes nothing when keys is empty.
func EnqueueDelete(ctx context.Context, tx pgx.Tx, keys []string) error {
	if len(keys) == 0 {
		return nil
	}
	return jobs.Enqueue(ctx, tx, _jobDeleteObjects, deleteObjectsPayload{Keys: keys})
}

// JobHandlers returns the job that deletes objects of store. A failed delete
// stays in the log: the data that pointed to the object is already gone.
func JobHandlers(store *Store, logger *slog.Logger) map[string]jobs.Handler {
	return map[string]jobs.Handler{
		_jobDeleteObjects: func(ctx context.Context, _ pgx.Tx, payload json.RawMessage) error {
			var job deleteObjectsPayload
			if err := json.Unmarshal(payload, &job); err != nil {
				return fmt.Errorf("decode the payload: %w", err)
			}
			for _, key := range job.Keys {
				if err := store.Delete(ctx, key); err != nil {
					logger.ErrorContext(ctx, "delete an unused object",
						slog.String("key", key), slog.Any("error", err))
				}
			}
			return nil
		},
	}
}
