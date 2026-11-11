package alerts

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
	if err := queries.DeleteOwnerLocation(ctx, ownerID); err != nil {
		return nil, fmt.Errorf("delete the location of the owner: %w", err)
	}
	if err := queries.DeleteOwnerNotifications(ctx, ownerID); err != nil {
		return nil, fmt.Errorf("delete the notifications of the owner: %w", err)
	}
	if err := queries.DeleteOwnerDevices(ctx, ownerID); err != nil {
		return nil, fmt.Errorf("delete the devices of the owner: %w", err)
	}
	return nil, nil
}

// PurgeExpired deletes, in tx, the locations updated before before (RN-42).
func (s *Service) PurgeExpired(ctx context.Context, tx pgx.Tx, before time.Time) error {
	if err := s.queries.WithTx(tx).PurgeOwnerLocations(ctx, before); err != nil {
		return fmt.Errorf("purge the owner locations: %w", err)
	}
	return nil
}
