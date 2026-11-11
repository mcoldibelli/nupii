// Package biometrics has the noseprints of the pets: the photo of the nose
// of a dog with the vector that the inference service makes from it.
package biometrics

import (
	"bytes"
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mcoldibelli/nupii/backend/internal/biometrics/biometricsdb"
	"github.com/mcoldibelli/nupii/backend/internal/identity"
	"github.com/mcoldibelli/nupii/backend/internal/pets"
	"github.com/mcoldibelli/nupii/backend/internal/platform/imagefile"
	"github.com/mcoldibelli/nupii/backend/internal/platform/inference"
)

const (
	// RN-59: a foto do focinho tem no máximo 8 MB (8 × 1.048.576 bytes).
	_maxPhotoBytes = 8 << 20
	// RN-06: a URL temporária de uma foto vale por 15 minutos.
	_photoURLExpiry = 15 * time.Minute
	// RN-07: só um pet da espécie cachorro tem cadastro biométrico.
	_speciesWithNoseprint = "dog"
)

var (
	// ErrSpeciesNotSupported means that the pet is not a dog (RN-07).
	ErrSpeciesNotSupported = errors.New("only a dog has a noseprint")
	// ErrNoseprintNotFound means that the pet has no noseprint.
	ErrNoseprintNotFound = errors.New("noseprint not found")
)

// ValidationError is the error for a photo that breaks a rule. Message
// says which rule.
type ValidationError struct {
	Message string
}

func (e *ValidationError) Error() string {
	return e.Message
}

// Noseprint is the photo of the nose of a pet, with data of its vector.
type Noseprint struct {
	ID string
	// ImageURL is a temporary URL of the photo of the nose.
	ImageURL     string
	Quality      float64
	ModelVersion string
	CapturedAt   time.Time
}

// OwnerFinder gives the owner that made a request. *identity.Service
// implements it. CurrentOwner returns identity.ErrOwnerNotFound when the
// account of the request did not register an owner.
type OwnerFinder interface {
	CurrentOwner(ctx context.Context) (identity.Owner, error)
}

// PetFinder gives a pet of the owner that made the request.
// *pets.Service implements it. Get returns pets.ErrPetNotFound when the
// pet does not exist for that owner.
type PetFinder interface {
	Get(ctx context.Context, id string) (pets.Pet, error)
}

// Embedder changes the photo of a nose into a vector. *inference.Client
// implements it.
type Embedder interface {
	Embed(ctx context.Context, image []byte) (inference.Embedding, error)
	// ModelVersion returns the label of the model that the service has now.
	ModelVersion(ctx context.Context) (string, error)
}

// PhotoStore keeps the photos of the noses. *storage.Store implements it.
type PhotoStore interface {
	Put(ctx context.Context, key, contentType string, body io.Reader, size int64) error
	Delete(ctx context.Context, key string) error
	SignedURL(key string, expires time.Duration) (string, error)
	// Get returns the content of an object with at most maxBytes.
	Get(ctx context.Context, key string, maxBytes int64) ([]byte, error)
}

// Service has the rules of the noseprints.
type Service struct {
	pool     *pgxpool.Pool
	queries  *biometricsdb.Queries
	owners   OwnerFinder
	pets     PetFinder
	embedder Embedder
	photos   PhotoStore
	logger   *slog.Logger
}

// NewService returns the service that keeps the noseprints in the database
// of pool and the photos in photos.
func NewService(
	pool *pgxpool.Pool,
	owners OwnerFinder,
	petFinder PetFinder,
	embedder Embedder,
	photos PhotoStore,
	logger *slog.Logger,
) *Service {
	return &Service{
		pool:     pool,
		queries:  biometricsdb.New(pool),
		owners:   owners,
		pets:     petFinder,
		embedder: embedder,
		photos:   photos,
		logger:   logger,
	}
}

// Register makes a noseprint of the pet petID of the owner that made the
// request, from the photo of its nose. The new noseprint becomes the
// primary one of the pet (RN-09).
//
// It returns ErrSpeciesNotSupported when the pet is not a dog, a
// ValidationError when photo is not an accepted image, and the errors of
// the Embedder when the inference service refuses the photo or fails.
func (s *Service) Register(ctx context.Context, petID string, photo io.Reader) (Noseprint, error) {
	pet, err := s.pets.Get(ctx, petID)
	if err != nil {
		return Noseprint{}, fmt.Errorf("get the pet of the noseprint: %w", err)
	}
	if pet.Species != _speciesWithNoseprint {
		return Noseprint{}, ErrSpeciesNotSupported
	}
	data, contentType, extension, err := readPhoto(photo)
	if err != nil {
		return Noseprint{}, err
	}

	// RN-08: o vetor é gerado antes de a foto ser salva. Uma foto recusada
	// pela inferência não é gravada.
	embedding, err := s.embedder.Embed(ctx, data)
	if err != nil {
		return Noseprint{}, fmt.Errorf("embed the photo of the nose: %w", err)
	}

	key := "noseprints/" + petID + "/" + strings.ToLower(rand.Text()) + "." + extension
	err = s.photos.Put(ctx, key, contentType, bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return Noseprint{}, fmt.Errorf("store the photo of the nose: %w", err)
	}
	row, err := s.create(ctx, biometricsdb.CreateNoseprintParams{
		PetID:        petID,
		ImageKey:     key,
		Embedding:    vectorText(embedding.Vector),
		ModelVersion: embedding.ModelVersion,
		Quality:      embedding.Quality,
	})
	if err != nil {
		// No noseprint points to the new object, so it is deleted. The
		// delete continues when the client ends the request before it.
		if derr := s.photos.Delete(context.WithoutCancel(ctx), key); derr != nil {
			s.logger.ErrorContext(ctx, "delete the photo of a noseprint that was not created",
				slog.String("key", key), slog.Any("error", derr))
		}
		return Noseprint{}, err
	}
	return s.noseprint(row.ID, row.ImageKey, row.ModelVersion, row.Quality, row.CapturedAt)
}

// create writes the noseprint as the primary one of the pet, in one
// transaction. It returns pets.ErrPetNotFound when the pet was deleted
// after the start of the request.
func (s *Service) create(
	ctx context.Context,
	params biometricsdb.CreateNoseprintParams,
) (row biometricsdb.CreateNoseprintRow, err error) {
	err = s.inTx(ctx, "noseprint", func(tx pgx.Tx) error {
		queries := s.queries.WithTx(tx)
		if _, err := queries.LockPet(ctx, params.PetID); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return pets.ErrPetNotFound
			}
			return fmt.Errorf("lock the pet of the noseprint: %w", err)
		}
		// RN-09: o cadastro novo passa a ser o principal do pet. Os
		// cadastros anteriores continuam ativos.
		if err := queries.DemotePrimaryNoseprint(ctx, params.PetID); err != nil {
			return fmt.Errorf("demote the primary noseprint: %w", err)
		}
		row, err = queries.CreateNoseprint(ctx, params)
		if err != nil {
			return fmt.Errorf("create noseprint: %w", err)
		}
		return nil
	})
	return row, err
}

// Primary returns the primary noseprint of the pet petID of the owner that
// made the request (RN-60). It returns ErrNoseprintNotFound when the pet
// has no noseprint.
func (s *Service) Primary(ctx context.Context, petID string) (Noseprint, error) {
	if _, err := s.pets.Get(ctx, petID); err != nil {
		return Noseprint{}, fmt.Errorf("get the pet of the noseprint: %w", err)
	}
	row, err := s.queries.GetPrimaryNoseprint(ctx, petID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Noseprint{}, ErrNoseprintNotFound
	}
	if err != nil {
		return Noseprint{}, fmt.Errorf("get the primary noseprint: %w", err)
	}
	return s.noseprint(row.ID, row.ImageKey, row.ModelVersion, row.Quality, row.CapturedAt)
}

func (s *Service) noseprint(
	id, imageKey, modelVersion string,
	quality float64,
	capturedAt time.Time,
) (Noseprint, error) {
	imageURL, err := s.photos.SignedURL(imageKey, _photoURLExpiry)
	if err != nil {
		return Noseprint{}, fmt.Errorf("sign the URL of the photo of the nose: %w", err)
	}
	return Noseprint{
		ID:           id,
		ImageURL:     imageURL,
		Quality:      quality,
		ModelVersion: modelVersion,
		CapturedAt:   capturedAt,
	}, nil
}

// readPhoto reads the photo of a nose and applies RN-59. It returns the
// bytes, the content type and the file extension of the photo.
func readPhoto(photo io.Reader) (data []byte, contentType, extension string, err error) {
	// One byte over the limit is enough to know that the photo is too big.
	data, err = io.ReadAll(io.LimitReader(photo, _maxPhotoBytes+1))
	if err != nil {
		return nil, "", "", &ValidationError{Message: "the photo could not be read"}
	}
	contentType, extension, err = checkPhoto(data)
	if err != nil {
		return nil, "", "", err
	}
	return data, contentType, extension, nil
}

// checkPhoto applies RN-59 and returns the content type and the file
// extension of the photo of a nose.
//
// RN-59: a foto do focinho é uma imagem JPEG, PNG ou WebP de até 8 MB.
func checkPhoto(data []byte) (contentType, extension string, err error) {
	if len(data) > _maxPhotoBytes {
		return "", "", &ValidationError{Message: "the photo must have at most 8 MB"}
	}
	contentType, extension, ok := imagefile.Type(data)
	if !ok {
		return "", "", &ValidationError{Message: "the photo must be a JPEG, PNG or WebP image"}
	}
	return contentType, extension, nil
}

// vectorText returns vector in the text format of pgvector: [0.1,0.2].
func vectorText(vector []float32) string {
	text := make([]byte, 0, 12*len(vector))
	text = append(text, '[')
	for i, value := range vector {
		if i > 0 {
			text = append(text, ',')
		}
		text = strconv.AppendFloat(text, float64(value), 'g', -1, 32)
	}
	return string(append(text, ']'))
}
