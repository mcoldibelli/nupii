package biometrics

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"github.com/mcoldibelli/nupii/backend/internal/biometrics/biometricsdb"
	"github.com/mcoldibelli/nupii/backend/internal/platform/inference"
	"github.com/mcoldibelli/nupii/backend/internal/platform/storage"
)

// ReembedResult says what one recompute of the vectors did.
type ReembedResult struct {
	// ModelVersion is the model version of the inference service.
	ModelVersion string
	// Pending is the number of noseprints that had another model version.
	Pending int
	// Updated is the number of noseprints that got the vector of ModelVersion.
	Updated int
	// Skipped is the number of noseprints that keep the old vector: the
	// model refused the stored photo, or the photo does not exist.
	Skipped int
}

// Reembed makes the vector of each noseprint that has another model version
// than the inference service, from the stored photo of the nose (RF-15,
// RN-67). It is safe to run two times: it reads only the noseprints of
// another version.
//
// It stops and returns inference.ErrUnavailable when the inference service
// does not respond, and stops with another error when the object store or
// the database fails. The noseprints that are left stay for the next run.
func (s *Service) Reembed(ctx context.Context) (ReembedResult, error) {
	version, err := s.embedder.ModelVersion(ctx)
	if err != nil {
		return ReembedResult{}, fmt.Errorf("get the model version: %w", err)
	}
	result := ReembedResult{ModelVersion: version}
	pending, err := s.queries.ListNoseprintsOfOtherVersions(ctx, version)
	if err != nil {
		return result, fmt.Errorf("list the noseprints of other model versions: %w", err)
	}
	result.Pending = len(pending)

	for _, noseprint := range pending {
		updated, err := s.reembed(ctx, noseprint)
		switch {
		case err == nil && updated:
			result.Updated++
		case err == nil:
			// Another recompute changed the noseprint first.
		case errors.Is(err, errPhotoNotUsable):
			// RN-67: uma foto que a versão nova recusa fica com o vetor
			// antigo, fora da busca.
			result.Skipped++
			s.logger.WarnContext(ctx, "noseprint keeps the vector of another model version",
				slog.String("noseprint_id", noseprint.ID), slog.Any("error", err))
		default:
			return result, fmt.Errorf("reembed the noseprint %s: %w", noseprint.ID, err)
		}
	}
	return result, nil
}

// errPhotoNotUsable means that a stored photo cannot give a new vector.
var errPhotoNotUsable = errors.New("the stored photo cannot be used")

// reembed makes the new vector of one noseprint. It returns
// errPhotoNotUsable when the photo cannot be read or the model refuses it.
func (s *Service) reembed(
	ctx context.Context,
	noseprint biometricsdb.ListNoseprintsOfOtherVersionsRow,
) (updated bool, err error) {
	photo, err := s.photos.Get(ctx, noseprint.ImageKey, _maxPhotoBytes)
	if errors.Is(err, storage.ErrNotFound) {
		return false, fmt.Errorf("%w: %w", errPhotoNotUsable, err)
	}
	if err != nil {
		// The store does not respond: the next photos would fail too.
		return false, fmt.Errorf("read the stored photo: %w", err)
	}
	embedding, err := s.embedder.Embed(ctx, photo)
	switch {
	case errors.Is(err, inference.ErrLowQuality),
		errors.Is(err, inference.ErrFraming),
		errors.Is(err, inference.ErrInvalidImage):
		return false, fmt.Errorf("%w: %w", errPhotoNotUsable, err)
	case err != nil:
		return false, fmt.Errorf("embed the stored photo: %w", err)
	}
	rows, err := s.queries.UpdateNoseprintEmbedding(ctx, biometricsdb.UpdateNoseprintEmbeddingParams{
		ID:                   noseprint.ID,
		Embedding:            vectorText(embedding.Vector),
		ModelVersion:         embedding.ModelVersion,
		Quality:              embedding.Quality,
		PreviousModelVersion: noseprint.ModelVersion,
	})
	if err != nil {
		return false, fmt.Errorf("update the vector: %w", err)
	}
	return rows == 1, nil
}
