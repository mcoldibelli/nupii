package reports

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
	if err := queries.EraseOwnerReports(ctx, &ownerID); err != nil {
		return nil, fmt.Errorf("erase the reports of the owner: %w", err)
	}
	return nil, nil
}
