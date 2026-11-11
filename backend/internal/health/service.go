// Package health has the health events of the pets and their upcoming care
// (ADR 0026).
package health

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mcoldibelli/nupii/backend/internal/health/healthdb"
	"github.com/mcoldibelli/nupii/backend/internal/identity"
	"github.com/mcoldibelli/nupii/backend/internal/pets"
)

// ErrEventNotFound means that the event does not exist for the pet.
var ErrEventNotFound = errors.New("health event not found")

// Event is a health event of a pet.
type Event struct {
	Input

	ID        string
	PetID     string
	CreatedAt time.Time
}

// Care is one upcoming care of a pet (RN-81).
type Care struct {
	EventID string
	PetID   string
	PetName string
	Type    string
	// Title is the name of the vaccine or of the medication.
	Title   string
	DueDate time.Time
}

// OwnerFinder gives the owner that made a request. *identity.Service
// implements it.
type OwnerFinder interface {
	CurrentOwner(ctx context.Context) (identity.Owner, error)
}

// PetFinder gives a pet of the owner that made the request.
// *pets.Service implements it. Get returns pets.ErrPetNotFound when the pet
// does not exist for that owner (RN-76).
type PetFinder interface {
	Get(ctx context.Context, id string) (pets.Pet, error)
}

// Service has the rules of the health events.
type Service struct {
	pool    *pgxpool.Pool
	queries *healthdb.Queries
	owners  OwnerFinder
	pets    PetFinder
	photos  PhotoStore
	logger  *slog.Logger
	now     func() time.Time
}

// NewService returns the service that keeps the events in the database of
// pool and the attachments in photos.
func NewService(
	pool *pgxpool.Pool,
	owners OwnerFinder,
	petFinder PetFinder,
	photos PhotoStore,
	logger *slog.Logger,
) *Service {
	return &Service{
		pool: pool, queries: healthdb.New(pool), owners: owners, pets: petFinder,
		photos: photos, logger: logger, now: time.Now,
	}
}

// today returns the date of today, in UTC (RN-50).
func (s *Service) today() time.Time {
	now := s.now().UTC()
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
}

// checkPet returns pets.ErrPetNotFound when the pet is not of the owner
// that made the request (RN-76).
func (s *Service) checkPet(ctx context.Context, petID string) error {
	if _, err := s.pets.Get(ctx, petID); err != nil {
		return fmt.Errorf("get the pet of the health event: %w", err)
	}
	return nil
}

// List returns the events of the pet petID, from the newest to the oldest.
func (s *Service) List(ctx context.Context, petID string) ([]Event, error) {
	if err := s.checkPet(ctx, petID); err != nil {
		return nil, err
	}
	rows, err := s.queries.ListHealthEvents(ctx, petID)
	if err != nil {
		return nil, fmt.Errorf("list health events: %w", err)
	}
	events := make([]Event, 0, len(rows))
	for _, row := range rows {
		events = append(events, eventOf(row))
	}
	return events, nil
}

// Create creates an event of the pet petID (RF-27).
func (s *Service) Create(ctx context.Context, petID string, input Input) (Event, error) {
	input, err := validate(input, s.today())
	if err != nil {
		return Event{}, err
	}
	if err := s.checkPet(ctx, petID); err != nil {
		return Event{}, err
	}
	row, err := s.queries.CreateHealthEvent(ctx, healthdb.CreateHealthEventParams{
		PetID: petID, Type: input.Type, Date: input.Date, Notes: input.Notes, Name: input.Name,
		Vet: input.Vet, Manufacturer: input.Manufacturer, Batch: input.Batch, Dose: input.Dose,
		NextDoseDate: input.NextDoseDate, Clinic: input.Clinic, Reason: input.Reason,
		Diagnosis: input.Diagnosis, WeightKg: input.WeightKg, ReturnDate: input.ReturnDate,
		MedicationCategory: input.MedicationCategory, ActiveIngredient: input.ActiveIngredient,
		Dosage: input.Dosage, Frequency: input.Frequency, EndDate: input.EndDate,
		InUse: input.InUse, IntervalDays: input.IntervalDays, Lab: input.Lab,
		Result: input.Result, NoteCategory: input.NoteCategory, Title: input.Title,
		Remind: input.Remind,
	})
	if err != nil {
		return Event{}, fmt.Errorf("create health event: %w", err)
	}
	return eventOf(row), nil
}

// Update replaces all the data of the event eventID of the pet petID. It
// returns ErrEventNotFound when the event is not of the pet.
func (s *Service) Update(ctx context.Context, petID, eventID string, input Input) (Event, error) {
	input, err := validate(input, s.today())
	if err != nil {
		return Event{}, err
	}
	if err := s.checkPet(ctx, petID); err != nil {
		return Event{}, err
	}
	row, err := s.queries.UpdateHealthEvent(ctx, healthdb.UpdateHealthEventParams{
		ID: eventID, PetID: petID, Type: input.Type, Date: input.Date, Notes: input.Notes,
		Name: input.Name, Vet: input.Vet, Manufacturer: input.Manufacturer, Batch: input.Batch,
		Dose: input.Dose, NextDoseDate: input.NextDoseDate, Clinic: input.Clinic,
		Reason: input.Reason, Diagnosis: input.Diagnosis, WeightKg: input.WeightKg,
		ReturnDate: input.ReturnDate, MedicationCategory: input.MedicationCategory,
		ActiveIngredient: input.ActiveIngredient, Dosage: input.Dosage,
		Frequency: input.Frequency, EndDate: input.EndDate, InUse: input.InUse,
		IntervalDays: input.IntervalDays, Lab: input.Lab, Result: input.Result,
		NoteCategory: input.NoteCategory, Title: input.Title, Remind: input.Remind,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return Event{}, ErrEventNotFound
	}
	if err != nil {
		return Event{}, fmt.Errorf("update health event: %w", err)
	}
	return eventOf(row), nil
}

// Delete deletes the event eventID of the pet petID. It returns
// ErrEventNotFound when the event is not of the pet.
func (s *Service) Delete(ctx context.Context, petID, eventID string) error {
	if err := s.checkPet(ctx, petID); err != nil {
		return err
	}
	var keys []string
	err := s.inTx(ctx, func(tx pgx.Tx) error {
		queries := s.queries.WithTx(tx)
		if err := lockEvent(ctx, queries, petID, eventID); err != nil {
			return err
		}
		row, err := queries.DeleteHealthEvent(ctx, healthdb.DeleteHealthEventParams{
			ID: eventID, PetID: petID,
		})
		if err != nil {
			return fmt.Errorf("delete health event: %w", err)
		}
		keys = row.Keys
		return nil
	})
	if err != nil {
		return err
	}
	// RN-82: apagar um evento apaga os anexos dele.
	s.deleteObjects(ctx, keys)
	return nil
}

// UpcomingCare returns the upcoming care of the pets of the owner that made
// the request, from the nearest date to the farthest (RF-29, RN-81).
func (s *Service) UpcomingCare(ctx context.Context) ([]Care, error) {
	owner, err := s.owners.CurrentOwner(ctx)
	if err != nil {
		return nil, fmt.Errorf("find the owner of the request: %w", err)
	}
	rows, err := s.queries.ListUpcomingCare(ctx, owner.ID)
	if err != nil {
		return nil, fmt.Errorf("list the upcoming care: %w", err)
	}
	care := make([]Care, 0, len(rows))
	for _, row := range rows {
		title := ""
		if row.Name != nil {
			title = *row.Name
		}
		care = append(care, Care{
			EventID: row.ID, PetID: row.PetID, PetName: row.PetName,
			Type: row.Type, Title: title, DueDate: row.DueDate,
		})
	}
	return care, nil
}

func eventOf(row healthdb.HealthEvent) Event {
	return Event{
		ID:        row.ID,
		PetID:     row.PetID,
		CreatedAt: row.CreatedAt,
		Input: Input{
			Type: row.Type, Date: row.Date, Notes: row.Notes, Name: row.Name, Vet: row.Vet,
			Manufacturer: row.Manufacturer, Batch: row.Batch, Dose: row.Dose,
			NextDoseDate: row.NextDoseDate, Clinic: row.Clinic, Reason: row.Reason,
			Diagnosis: row.Diagnosis, WeightKg: row.WeightKg, ReturnDate: row.ReturnDate,
			MedicationCategory: row.MedicationCategory, ActiveIngredient: row.ActiveIngredient,
			Dosage: row.Dosage, Frequency: row.Frequency, EndDate: row.EndDate,
			InUse: row.InUse, IntervalDays: row.IntervalDays, Lab: row.Lab,
			Result: row.Result, NoteCategory: row.NoteCategory, Title: row.Title,
			Remind: row.Remind,
		},
	}
}
