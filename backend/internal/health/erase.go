package health

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
	if err := queries.LockOwnerHealthEvents(ctx, ownerID); err != nil {
		return nil, fmt.Errorf("lock the health events of the owner: %w", err)
	}
	keys, err := queries.DeleteOwnerAttachments(ctx, ownerID)
	if err != nil {
		return nil, fmt.Errorf("delete the attachments of the owner: %w", err)
	}
	if err := queries.DeleteOwnerHealthEvents(ctx, ownerID); err != nil {
		return nil, fmt.Errorf("delete the health events of the owner: %w", err)
	}
	if err := queries.DeleteOwnerShareLinks(ctx, ownerID); err != nil {
		return nil, fmt.Errorf("delete the share links of the owner: %w", err)
	}
	return keys, nil
}
