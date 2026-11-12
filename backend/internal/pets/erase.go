package pets

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
)

// EraseOwner erases the data of the owner ownerID that this module keeps,
// in tx, when the account is deleted (RN-84). It returns the keys of the
// stored objects that the commit makes unused.
func (s *Service) EraseOwner(ctx context.Context, tx pgx.Tx, ownerID string) ([]string, error) {
	queries := s.queries.WithTx(tx)
	pets, err := queries.LockOwnerPets(ctx, ownerID)
	if err != nil {
		return nil, fmt.Errorf("lock the pets of the owner: %w", err)
	}
	var keys []string
	for _, pet := range pets {
		if pet.PhotoKey != nil {
			keys = append(keys, *pet.PhotoKey)
		}
	}
	if err := queries.EraseOwnerPets(ctx, ownerID); err != nil {
		return nil, fmt.Errorf("erase the pets of the owner: %w", err)
	}
	return keys, nil
}
