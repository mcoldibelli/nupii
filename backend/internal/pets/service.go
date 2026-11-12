// Package pets has the pets of an owner: the rules of their data and the
// operations to create, list, read, change and delete them.
package pets

import (
	"bytes"
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"math"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"

	"github.com/mcoldibelli/nupii/backend/internal/identity"
	"github.com/mcoldibelli/nupii/backend/internal/pets/petsdb"
	"github.com/mcoldibelli/nupii/backend/internal/platform/imagefile"
)

// RN-56: tamanhos máximos dos textos do pet, em caracteres.
const (
	_maxNameLength      = 100
	_maxBreedLength     = 100
	_maxVetNameLength   = 120
	_maxVetClinicLength = 120
	_maxVetPhoneLength  = 30
)

// RN-51: o peso fica entre 0,01 kg e 999,99 kg, com no máximo 2 casas decimais.
const (
	_minWeightKg = 0.01
	_maxWeightKg = 999.99
	// _weightTolerance is the difference from a value with 2 decimal places
	// that the binary form of a decimal number can have. A third decimal
	// place is a larger difference.
	_weightTolerance = 1e-9
)

const (
	// RN-54: a foto de perfil tem no máximo 5 MB (5 × 1.048.576 bytes).
	_maxPhotoBytes = 5 << 20
	// RN-06: a URL temporária da foto é válida por 15 minutos.
	_photoURLExpiry = 15 * time.Minute
)

// ErrPetNotFound means that the pet does not exist for the owner: it has
// another owner, it was deleted, or it never existed.
var ErrPetNotFound = errors.New("pet not found")

// ValidationError is the error for data of a pet that breaks a rule. The
// message says which rule, and it can go to the client.
type ValidationError struct {
	Message string
}

func (e *ValidationError) Error() string {
	return "invalid pet: " + e.Message
}

// Input has the data of a pet that the owner gives. A nil field has no value.
type Input struct {
	Name      string
	Species   string
	Breed     *string
	Sex       *string
	Size      *string
	BirthDate *time.Time
	WeightKg  *float64
	Neutered  *bool
	VetName   *string
	VetClinic *string
	VetPhone  *string
}

// Pet is a pet of an owner.
type Pet struct {
	Input

	ID        string
	CreatedAt time.Time
	// PhotoURL is a temporary URL of the profile photo, or nil when the
	// pet has no photo.
	PhotoURL *string
}

// OwnerFinder gives the owner that made a request. *identity.Service
// implements it. CurrentOwner returns identity.ErrOwnerNotFound when the
// account of the request did not register an owner.
type OwnerFinder interface {
	CurrentOwner(ctx context.Context) (identity.Owner, error)
}

// PhotoStore keeps the profile photos. *storage.Store implements it.
type PhotoStore interface {
	Put(ctx context.Context, key, contentType string, body io.Reader, size int64) error
	Delete(ctx context.Context, key string) error
	SignedURL(key string, expires time.Duration) (string, error)
}

// Service has the rules of the pets.
type Service struct {
	queries *petsdb.Queries
	owners  OwnerFinder
	photos  PhotoStore
	logger  *slog.Logger
}

// NewService returns a Service that reads and writes with db, finds the
// owner of an account with owners and keeps the photos in photos.
func NewService(
	db petsdb.DBTX,
	owners OwnerFinder,
	photos PhotoStore,
	logger *slog.Logger,
) *Service {
	return &Service{queries: petsdb.New(db), owners: owners, photos: photos, logger: logger}
}

// ownerID returns the identifier of the owner that made the request of ctx.
func (s *Service) ownerID(ctx context.Context) (string, error) {
	owner, err := s.owners.CurrentOwner(ctx)
	if err != nil {
		return "", fmt.Errorf("find the owner of the request: %w", err)
	}
	return owner.ID, nil
}

// Create creates a pet of the owner that made the request.
func (s *Service) Create(ctx context.Context, input Input) (Pet, error) {
	input, err := validate(input, time.Now())
	if err != nil {
		return Pet{}, err
	}
	ownerID, err := s.ownerID(ctx)
	if err != nil {
		return Pet{}, err
	}
	row, err := s.queries.CreatePet(ctx, petsdb.CreatePetParams{
		OwnerID:   ownerID,
		Name:      input.Name,
		Species:   input.Species,
		Breed:     input.Breed,
		Sex:       input.Sex,
		Size:      input.Size,
		BirthDate: input.BirthDate,
		WeightKg:  input.WeightKg,
		Neutered:  input.Neutered,
		VetName:   input.VetName,
		VetClinic: input.VetClinic,
		VetPhone:  input.VetPhone,
	})
	if err != nil {
		return Pet{}, fmt.Errorf("create pet: %w", err)
	}
	return s.pet(row)
}

// List returns the pets of the owner that made the request that are not
// deleted, in name order (RN-53).
func (s *Service) List(ctx context.Context) ([]Pet, error) {
	ownerID, err := s.ownerID(ctx)
	if err != nil {
		return nil, err
	}
	rows, err := s.queries.ListPets(ctx, ownerID)
	if err != nil {
		return nil, fmt.Errorf("list pets: %w", err)
	}
	pets := make([]Pet, 0, len(rows))
	for _, row := range rows {
		pet, err := s.pet(row)
		if err != nil {
			return nil, err
		}
		pets = append(pets, pet)
	}
	return pets, nil
}

// Get returns the pet id of the owner that made the request. It returns
// ErrPetNotFound when the pet does not exist for that owner (RN-52).
func (s *Service) Get(ctx context.Context, id string) (Pet, error) {
	ownerID, err := s.ownerID(ctx)
	if err != nil {
		return Pet{}, err
	}
	row, err := s.queries.GetPet(ctx, petsdb.GetPetParams{ID: id, OwnerID: ownerID})
	if errors.Is(err, pgx.ErrNoRows) {
		return Pet{}, ErrPetNotFound
	}
	if err != nil {
		return Pet{}, fmt.Errorf("get pet: %w", err)
	}
	return s.pet(row)
}

// Update replaces all the data of the pet id of the owner that made the
// request. It returns ErrPetNotFound when the pet does not exist for that
// owner.
func (s *Service) Update(ctx context.Context, id string, input Input) (Pet, error) {
	input, err := validate(input, time.Now())
	if err != nil {
		return Pet{}, err
	}
	ownerID, err := s.ownerID(ctx)
	if err != nil {
		return Pet{}, err
	}
	row, err := s.queries.UpdatePet(ctx, petsdb.UpdatePetParams{
		ID:        id,
		OwnerID:   ownerID,
		Name:      input.Name,
		Species:   input.Species,
		Breed:     input.Breed,
		Sex:       input.Sex,
		Size:      input.Size,
		BirthDate: input.BirthDate,
		WeightKg:  input.WeightKg,
		Neutered:  input.Neutered,
		VetName:   input.VetName,
		VetClinic: input.VetClinic,
		VetPhone:  input.VetPhone,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return Pet{}, ErrPetNotFound
	}
	if err != nil {
		return Pet{}, fmt.Errorf("update pet: %w", err)
	}
	return s.pet(row)
}

// Delete deletes the pet id of the owner that made the request. The row
// stays in the database with the date of the delete, and the profile photo
// is deleted from the store (RN-05). It returns ErrPetNotFound when the pet
// does not exist for that owner.
func (s *Service) Delete(ctx context.Context, id string) error {
	ownerID, err := s.ownerID(ctx)
	if err != nil {
		return err
	}
	// The statement returns the key of the photo that the pet had, so the
	// photo of an upload that ended a moment before is deleted too.
	previousKey, err := s.queries.DeletePet(ctx, petsdb.DeletePetParams{ID: id, OwnerID: ownerID})
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrPetNotFound
	}
	if err != nil {
		return fmt.Errorf("delete pet: %w", err)
	}
	s.deletePhoto(ctx, previousKey)
	return nil
}

// SetPhoto stores photo as the profile photo of the pet id of the owner
// that made the request, and deletes the photo that the pet had (RN-55).
// It returns a ValidationError when photo is not an accepted image (RN-54).
func (s *Service) SetPhoto(ctx context.Context, id string, photo io.Reader) (Pet, error) {
	ownerID, err := s.ownerID(ctx)
	if err != nil {
		return Pet{}, err
	}
	_, err = s.queries.GetPet(ctx, petsdb.GetPetParams{ID: id, OwnerID: ownerID})
	if errors.Is(err, pgx.ErrNoRows) {
		return Pet{}, ErrPetNotFound
	}
	if err != nil {
		return Pet{}, fmt.Errorf("get pet: %w", err)
	}

	// One byte over the limit is enough to know that the photo is too big.
	data, err := io.ReadAll(io.LimitReader(photo, _maxPhotoBytes+1))
	if err != nil {
		s.logger.WarnContext(ctx, "read the photo of the request", slog.Any("error", err))
		return Pet{}, &ValidationError{Message: "the photo could not be read"}
	}
	contentType, extension, err := checkPhoto(data)
	if err != nil {
		return Pet{}, err
	}

	key := "pets/" + id + "/profile/" + strings.ToLower(rand.Text()) + "." + extension
	err = s.photos.Put(ctx, key, contentType, bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return Pet{}, fmt.Errorf("store photo: %w", err)
	}
	// The statement sets the new key and returns the key that it replaced.
	// With two uploads at the same time, each one deletes the photo that it
	// replaced, and the pet keeps the photo of the last one.
	row, err := s.queries.SetPetPhoto(ctx, petsdb.SetPetPhotoParams{
		ID:       id,
		OwnerID:  ownerID,
		PhotoKey: &key,
	})
	if err != nil {
		// The pet does not point to the new object, so it is deleted.
		s.deletePhoto(ctx, &key)
		if errors.Is(err, pgx.ErrNoRows) {
			return Pet{}, ErrPetNotFound
		}
		return Pet{}, fmt.Errorf("set the photo of the pet: %w", err)
	}
	s.deletePhoto(ctx, row.PreviousPhotoKey)
	return s.pet(petsdb.Pet{
		ID:        row.ID,
		OwnerID:   row.OwnerID,
		Name:      row.Name,
		Species:   row.Species,
		Breed:     row.Breed,
		Sex:       row.Sex,
		Size:      row.Size,
		BirthDate: row.BirthDate,
		WeightKg:  row.WeightKg,
		Neutered:  row.Neutered,
		VetName:   row.VetName,
		VetClinic: row.VetClinic,
		VetPhone:  row.VetPhone,
		CreatedAt: row.CreatedAt,
		UpdatedAt: row.UpdatedAt,
		DeletedAt: row.DeletedAt,
		PhotoKey:  row.PhotoKey,
	})
}

// checkPhoto applies RN-54 and returns the content type and the file
// extension of the photo.
//
// RN-54: a foto de perfil é uma imagem JPEG, PNG ou WebP, com no máximo 5 MB.
func checkPhoto(data []byte) (contentType, extension string, err error) {
	if len(data) > _maxPhotoBytes {
		return "", "", &ValidationError{Message: "the photo must have at most 5 MB"}
	}
	contentType, extension, ok := imagefile.Type(data)
	if !ok {
		return "", "", &ValidationError{Message: "the photo must be a JPEG, PNG or WebP image"}
	}
	return contentType, extension, nil
}

// deletePhoto deletes the object key from the store, when key is not nil.
// A failure stays in the log: the object is no longer used by a pet, and
// the request that made it unused must not fail because of it. The delete
// continues when the client ends the request before it.
func (s *Service) deletePhoto(ctx context.Context, key *string) {
	if key == nil {
		return
	}
	if err := s.photos.Delete(context.WithoutCancel(ctx), *key); err != nil {
		s.logger.ErrorContext(ctx, "delete unused pet photo",
			slog.String("key", *key), slog.Any("error", err))
	}
}

// ValidWeight tells if weight is a weight of a pet, in kilograms.
//
// RN-51: o peso fica entre 0,01 kg e 999,99 kg, com no máximo 2 casas decimais.
func ValidWeight(weight float64) bool {
	cents := weight * 100
	hasTwoDecimals := math.Abs(cents-math.Round(cents)) <= _weightTolerance
	return weight >= _minWeightKg && weight <= _maxWeightKg && hasTwoDecimals
}

// validate applies the rules of the data of a pet. It returns the input
// with the spaces around the texts removed, and with nil in place of an
// optional text that is empty. The time now gives the date of today.
func validate(input Input, now time.Time) (Input, error) {
	invalid := func(message string) (Input, error) {
		return Input{}, &ValidationError{Message: message}
	}

	// RN-48: o nome e a espécie do pet são obrigatórios. A espécie é
	// cachorro, gato ou outro.
	input.Name = strings.TrimSpace(input.Name)
	if input.Name == "" {
		return invalid("name is required")
	}
	if !slices.Contains([]string{"dog", "cat", "other"}, input.Species) {
		return invalid("species must be dog, cat or other")
	}

	// RN-49: o sexo é macho, fêmea ou indefinido. O porte é pequeno, médio
	// ou grande. Os dois são opcionais.
	sexes := []string{"male", "female", "unknown"}
	if input.Sex != nil && !slices.Contains(sexes, *input.Sex) {
		return invalid("sex must be male, female or unknown")
	}
	sizes := []string{"small", "medium", "large"}
	if input.Size != nil && !slices.Contains(sizes, *input.Size) {
		return invalid("size must be small, medium or large")
	}

	// RN-50: a data de nascimento, quando informada, não é uma data futura.
	// A data de hoje é a data em UTC.
	if input.BirthDate != nil {
		today := now.UTC().Truncate(24 * time.Hour)
		if input.BirthDate.After(today) {
			return invalid("birthDate must not be in the future")
		}
	}

	// RN-51: o peso, quando informado, fica entre 0,01 kg e 999,99 kg, com
	// no máximo 2 casas decimais.
	if input.WeightKg != nil && !ValidWeight(*input.WeightKg) {
		return invalid("weightKg must be from 0.01 to 999.99, with at most 2 decimal places")
	}

	// RN-56: tamanhos máximos dos textos do pet, sem os espaços do começo e
	// do fim.
	input.Breed = trimOptional(input.Breed)
	input.VetName = trimOptional(input.VetName)
	input.VetClinic = trimOptional(input.VetClinic)
	input.VetPhone = trimOptional(input.VetPhone)
	limits := []struct {
		field string
		value *string
		max   int
	}{
		{field: "name", value: &input.Name, max: _maxNameLength},
		{field: "breed", value: input.Breed, max: _maxBreedLength},
		{field: "vetName", value: input.VetName, max: _maxVetNameLength},
		{field: "vetClinic", value: input.VetClinic, max: _maxVetClinicLength},
		{field: "vetPhone", value: input.VetPhone, max: _maxVetPhoneLength},
	}
	for _, limit := range limits {
		if limit.value != nil && utf8.RuneCountInString(*limit.value) > limit.max {
			return invalid(fmt.Sprintf("%s must have at most %d characters", limit.field, limit.max))
		}
	}
	return input, nil
}

// trimOptional removes the spaces around an optional text. An empty text
// becomes nil.
func trimOptional(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

// pet converts a row to a Pet, with the temporary URL of the photo (RN-06).
func (s *Service) pet(row petsdb.Pet) (Pet, error) {
	pet := Pet{
		Input: Input{
			Name:      row.Name,
			Species:   row.Species,
			Breed:     row.Breed,
			Sex:       row.Sex,
			Size:      row.Size,
			BirthDate: row.BirthDate,
			WeightKg:  row.WeightKg,
			Neutered:  row.Neutered,
			VetName:   row.VetName,
			VetClinic: row.VetClinic,
			VetPhone:  row.VetPhone,
		},
		ID:        row.ID,
		CreatedAt: row.CreatedAt,
	}
	if row.PhotoKey != nil {
		url, err := s.photos.SignedURL(*row.PhotoKey, _photoURLExpiry)
		if err != nil {
			return Pet{}, fmt.Errorf("sign the photo URL of the pet %s: %w", row.ID, err)
		}
		pet.PhotoURL = &url
	}
	return pet, nil
}
