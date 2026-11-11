// Package pets has the pets of an owner: the rules of their data and the
// operations to create, list, read, change and delete them.
package pets

import (
	"context"
	"errors"
	"fmt"
	"math"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"

	"github.com/mcoldibelli/nupii/backend/internal/identity"
	"github.com/mcoldibelli/nupii/backend/internal/pets/petsdb"
)

// RN-56: tamanhos máximos dos textos do pet, em caracteres.
const (
	_maxNameLength     = 100
	_maxBreedLength    = 100
	_maxVetNameLength  = 120
	_maxVetClinicLen   = 120
	_maxVetPhoneLength = 30
)

// RN-51: o peso fica entre 0,01 kg e 999,99 kg.
const (
	_minWeightKg = 0.01
	_maxWeightKg = 999.99
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
}

// OwnerFinder gives the owner of an account. *identity.Service implements it.
type OwnerFinder interface {
	Owner(ctx context.Context, who identity.Identity) (identity.Owner, error)
}

// Service has the rules of the pets.
type Service struct {
	queries *petsdb.Queries
	owners  OwnerFinder
}

// NewService returns a Service that reads and writes with db and finds the
// owner of an account with owners.
func NewService(db petsdb.DBTX, owners OwnerFinder) *Service {
	return &Service{queries: petsdb.New(db), owners: owners}
}

// Create creates a pet of the owner of the account who.
func (s *Service) Create(ctx context.Context, who identity.Identity, input Input) (Pet, error) {
	input, err := validate(input, time.Now())
	if err != nil {
		return Pet{}, err
	}
	owner, err := s.owners.Owner(ctx, who)
	if err != nil {
		return Pet{}, fmt.Errorf("find the owner of the account: %w", err)
	}
	row, err := s.queries.CreatePet(ctx, petsdb.CreatePetParams{
		OwnerID:   owner.ID,
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
	return petFromRow(row), nil
}

// List returns the pets of the owner of the account who that are not
// deleted, in name order (RN-53).
func (s *Service) List(ctx context.Context, who identity.Identity) ([]Pet, error) {
	owner, err := s.owners.Owner(ctx, who)
	if err != nil {
		return nil, fmt.Errorf("find the owner of the account: %w", err)
	}
	rows, err := s.queries.ListPets(ctx, owner.ID)
	if err != nil {
		return nil, fmt.Errorf("list pets: %w", err)
	}
	pets := make([]Pet, 0, len(rows))
	for _, row := range rows {
		pets = append(pets, petFromRow(row))
	}
	return pets, nil
}

// Get returns the pet id of the owner of the account who. It returns
// ErrPetNotFound when the pet does not exist for that owner (RN-52).
func (s *Service) Get(ctx context.Context, who identity.Identity, id string) (Pet, error) {
	owner, err := s.owners.Owner(ctx, who)
	if err != nil {
		return Pet{}, fmt.Errorf("find the owner of the account: %w", err)
	}
	row, err := s.queries.GetPet(ctx, petsdb.GetPetParams{ID: id, OwnerID: owner.ID})
	if errors.Is(err, pgx.ErrNoRows) {
		return Pet{}, ErrPetNotFound
	}
	if err != nil {
		return Pet{}, fmt.Errorf("get pet: %w", err)
	}
	return petFromRow(row), nil
}

// Update replaces all the data of the pet id of the owner of the account
// who. It returns ErrPetNotFound when the pet does not exist for that owner.
func (s *Service) Update(
	ctx context.Context,
	who identity.Identity,
	id string,
	input Input,
) (Pet, error) {
	input, err := validate(input, time.Now())
	if err != nil {
		return Pet{}, err
	}
	owner, err := s.owners.Owner(ctx, who)
	if err != nil {
		return Pet{}, fmt.Errorf("find the owner of the account: %w", err)
	}
	row, err := s.queries.UpdatePet(ctx, petsdb.UpdatePetParams{
		ID:        id,
		OwnerID:   owner.ID,
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
	return petFromRow(row), nil
}

// Delete deletes the pet id of the owner of the account who. The row stays
// in the database with the date of the delete (RN-05). It returns
// ErrPetNotFound when the pet does not exist for that owner.
func (s *Service) Delete(ctx context.Context, who identity.Identity, id string) error {
	owner, err := s.owners.Owner(ctx, who)
	if err != nil {
		return fmt.Errorf("find the owner of the account: %w", err)
	}
	deleted, err := s.queries.DeletePet(ctx, petsdb.DeletePetParams{ID: id, OwnerID: owner.ID})
	if err != nil {
		return fmt.Errorf("delete pet: %w", err)
	}
	if deleted == 0 {
		return ErrPetNotFound
	}
	return nil
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
	if input.Sex != nil && !slices.Contains([]string{"male", "female", "unknown"}, *input.Sex) {
		return invalid("sex must be male, female or unknown")
	}
	if input.Size != nil && !slices.Contains([]string{"small", "medium", "large"}, *input.Size) {
		return invalid("size must be small, medium or large")
	}

	// RN-50: a data de nascimento, quando informada, não é uma data futura.
	if input.BirthDate != nil {
		today := now.UTC().Truncate(24 * time.Hour)
		if input.BirthDate.After(today) {
			return invalid("birthDate must not be in the future")
		}
	}

	// RN-51: o peso, quando informado, fica entre 0,01 kg e 999,99 kg, com
	// no máximo 2 casas decimais.
	if input.WeightKg != nil {
		weight := *input.WeightKg
		cents := weight * 100
		if weight < _minWeightKg || weight > _maxWeightKg || math.Abs(cents-math.Round(cents)) > 1e-6 {
			return invalid("weightKg must be from 0.01 to 999.99, with at most 2 decimal places")
		}
	}

	// RN-56: tamanhos máximos dos textos do pet.
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
		{field: "vetClinic", value: input.VetClinic, max: _maxVetClinicLen},
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

func petFromRow(row petsdb.Pet) Pet {
	return Pet{
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
}
