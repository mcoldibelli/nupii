package biometrics

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
)

// EraseOwner erases the data of the owner ownerID that this module keeps,
// in tx, when the account is deleted (RN-84). It returns the keys of the
// stored objects that the commit makes unused.
func (s *Service) EraseOwner(ctx context.Context, tx pgx.Tx, ownerID string) ([]string, error) {
	queries := s.queries.WithTx(tx)
	if err := queries.DeleteOwnerCandidates(ctx, ownerID); err != nil {
		return nil, fmt.Errorf("delete the candidates of the owner: %w", err)
	}
	keys, err := queries.DeleteOwnerNoseprints(ctx, ownerID)
	if err != nil {
		return nil, fmt.Errorf("delete the noseprints of the owner: %w", err)
	}
	return keys, nil
}

// PurgeExpired erases, in tx, the contact and the photo of the consults
// created before before (RN-42). It returns the keys of the photos.
func (s *Service) PurgeExpired(
	ctx context.Context,
	tx pgx.Tx,
	before time.Time,
) ([]string, error) {
	queries := s.queries.WithTx(tx)
	rows, err := queries.LockExpiredIdentifications(ctx, before)
	if err != nil {
		return nil, fmt.Errorf("lock the expired identifications: %w", err)
	}
	ids := make([]string, 0, len(rows))
	var keys []string
	for _, row := range rows {
		ids = append(ids, row.ID)
		if row.PhotoKey != nil {
			keys = append(keys, *row.PhotoKey)
		}
	}
	if err := queries.PurgeIdentifications(ctx, ids); err != nil {
		return nil, fmt.Errorf("purge the identifications: %w", err)
	}
	return keys, nil
}
