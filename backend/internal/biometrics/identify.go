package biometrics

import (
	"bytes"
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"log/slog"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"

	"github.com/mcoldibelli/nupii/backend/internal/alerts"
	"github.com/mcoldibelli/nupii/backend/internal/biometrics/biometricsdb"
	"github.com/mcoldibelli/nupii/backend/internal/platform/inference"
)

// RN-63: limites do contato de quem encontrou o cão.
const (
	_maxContactNameLength    = 120
	_maxContactMessageLength = 500
)

// RN-63: o telefone tem de 8 a 30 caracteres: dígitos, espaço, +, -, ( e ).
var _phonePattern = regexp.MustCompile(`^[0-9()+\- ]{8,30}$`)

// ErrIdentificationNotFound means that the identification does not exist,
// or that the candidate is not one of its candidates (RN-64).
var ErrIdentificationNotFound = errors.New("identification not found")

// Location is a point on the map, in degrees.
type Location struct {
	Latitude  float64
	Longitude float64
}

// valid tells if the location is a point of the Earth.
//
// RN-61: a latitude e a longitude são de um ponto da Terra.
func (l Location) valid() bool {
	// A value that is not a number (NaN) fails each comparison, so the
	// check says what is accepted.
	return l.Latitude >= -90 && l.Latitude <= 90 && l.Longitude >= -180 && l.Longitude <= 180
}

// Identification is the result of the search of one nose in the gallery.
type Identification struct {
	ID string
	// Candidates come from the most similar to the least similar.
	Candidates []Candidate
}

// Candidate is a pet that looks like the photo of the search. It has no
// data of the owner (RN-62).
type Candidate struct {
	ID      string
	PetName string
	// PetPhotoURL is a temporary URL of the profile photo of the pet, or
	// nil when the pet has no photo.
	PetPhotoURL *string
	Similarity  float64
	Strong      bool
}

// Contact is what the person that found a dog leaves for the owner.
type Contact struct {
	Name  string
	Phone string
	// Message is optional.
	Message *string
}

// FoundNotice is what an owner sees of a confirmation (RN-66).
type FoundNotice struct {
	ID      string
	PetID   string
	PetName string
	Contact Contact
	// Location is the point of the identification, or nil.
	Location    *Location
	ConfirmedAt time.Time
}

// Identify searches the gallery for the nose in photo. location is the
// point of the person that found the dog, or nil. The photo is not stored
// (RN-16).
//
// It returns a ValidationError when photo is not an accepted image, and the
// errors of the Embedder when the inference service refuses the photo or
// fails.
func (s *Service) Identify(
	ctx context.Context,
	photo []byte,
	location *Location,
) (Identification, error) {
	if _, _, err := checkPhoto(photo); err != nil {
		return Identification{}, err
	}
	if location != nil && !location.valid() {
		return Identification{}, &ValidationError{
			Message: "latitude must be from -90 to 90, and longitude from -180 to 180",
		}
	}
	embedding, err := s.embedder.Embed(ctx, photo)
	if err != nil {
		return Identification{}, fmt.Errorf("embed the photo of the nose: %w", err)
	}

	var result Identification
	err = s.inTx(ctx, "identification", func(tx pgx.Tx) error {
		matches, gallerySize, err := search(ctx, s.queries.WithTx(tx), tx, embedding)
		if err != nil {
			return err
		}
		result, err = s.createIdentification(ctx, s.queries.WithTx(tx),
			embedding.ModelVersion, location, rank(matches, gallerySize))
		return err
	})
	if err != nil {
		return Identification{}, err
	}
	return result, nil
}

// search reads the noseprints that are the most similar to embedding, and
// the number of pets in the gallery of the model version.
func search(
	ctx context.Context,
	queries *biometricsdb.Queries,
	tx pgx.Tx,
	embedding inference.Embedding,
) ([]match, int64, error) {
	// The index of the vectors reads 40 candidates by default, which is
	// less than the 50 of RN-10. With the iterative scan, the index reads
	// more candidates when the filters of RN-11 remove some of them.
	settings := []string{
		"SET LOCAL hnsw.ef_search = 100",
		"SET LOCAL hnsw.iterative_scan = strict_order",
	}
	for _, setting := range settings {
		if _, err := tx.Exec(ctx, setting); err != nil {
			return nil, 0, fmt.Errorf("%s: %w", setting, err)
		}
	}
	rows, err := queries.SearchNoseprints(ctx, biometricsdb.SearchNoseprintsParams{
		Embedding:    vectorText(embedding.Vector),
		ModelVersion: embedding.ModelVersion,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("search noseprints: %w", err)
	}
	gallerySize, err := queries.CountGalleryPets(ctx, embedding.ModelVersion)
	if err != nil {
		return nil, 0, fmt.Errorf("count the pets of the gallery: %w", err)
	}
	matches := make([]match, 0, len(rows))
	for _, row := range rows {
		matches = append(matches, match{
			NoseprintID: row.NoseprintID,
			PetID:       row.PetID,
			Similarity:  row.Similarity,
		})
	}
	return matches, gallerySize, nil
}

// createIdentification writes the identification with its candidates, and
// returns it with the name and the photo of each pet.
func (s *Service) createIdentification(
	ctx context.Context,
	queries *biometricsdb.Queries,
	modelVersion string,
	location *Location,
	candidates []candidate,
) (Identification, error) {
	params := biometricsdb.CreateIdentificationParams{ModelVersion: modelVersion}
	if location != nil {
		params.Latitude, params.Longitude = &location.Latitude, &location.Longitude
	}
	id, err := queries.CreateIdentification(ctx, params)
	if err != nil {
		return Identification{}, fmt.Errorf("create identification: %w", err)
	}
	result := Identification{ID: id, Candidates: make([]Candidate, 0, len(candidates))}
	if len(candidates) == 0 {
		return result, nil
	}

	petIDs := make([]string, 0, len(candidates))
	for _, found := range candidates {
		petIDs = append(petIDs, found.PetID)
	}
	petRows, err := queries.ListCandidatePets(ctx, petIDs)
	if err != nil {
		return Identification{}, fmt.Errorf("list the pets of the candidates: %w", err)
	}
	petByID := make(map[string]biometricsdb.ListCandidatePetsRow, len(petRows))
	for _, row := range petRows {
		petByID[row.ID] = row
	}
	for i, found := range candidates {
		candidateID, err := queries.CreateIdentificationCandidate(ctx,
			biometricsdb.CreateIdentificationCandidateParams{
				IdentificationID: id,
				NoseprintID:      found.NoseprintID,
				PetID:            found.PetID,
				// There are at most 3 candidates (RN-14), so the value fits.
				Rank:       int16(i + 1),
				Similarity: found.Similarity,
			})
		if err != nil {
			return Identification{}, fmt.Errorf("create identification candidate: %w", err)
		}
		pet := petByID[found.PetID]
		converted := Candidate{
			ID:         candidateID,
			PetName:    pet.Name,
			Similarity: found.Similarity,
			Strong:     found.Strong,
		}
		if pet.PhotoKey != nil {
			url, err := s.photos.SignedURL(*pet.PhotoKey, _photoURLExpiry)
			if err != nil {
				return Identification{}, fmt.Errorf("sign the URL of the pet photo: %w", err)
			}
			converted.PetPhotoURL = &url
		}
		result.Candidates = append(result.Candidates, converted)
	}
	return result, nil
}

// Confirm records that the person that found a dog chose the candidate
// candidateID of the identification identificationID, with the contact for
// the owner of the pet. photo is the photo of the search, or empty. It is
// stored only in the first confirmation that has it (RN-16, RN-65).
//
// It returns ErrIdentificationNotFound when the identification or the
// candidate does not exist, and a ValidationError when the contact or the
// photo breaks a rule.
func (s *Service) Confirm(
	ctx context.Context,
	identificationID, candidateID string,
	contact Contact,
	photo []byte,
) error {
	contact, err := validateContact(contact)
	if err != nil {
		return err
	}
	var contentType, extension string
	if len(photo) > 0 {
		if contentType, extension, err = checkPhoto(photo); err != nil {
			return err
		}
	}

	// The photo goes to the store before the transaction, so the
	// transaction does not hold the lock of the identification and a
	// connection of the pool during a call to the store.
	var storedKey *string
	if len(photo) > 0 {
		key := "identifications/" + identificationID + "/" +
			strings.ToLower(rand.Text()) + "." + extension
		err := s.photos.Put(ctx, key, contentType, bytes.NewReader(photo), int64(len(photo)))
		if err != nil {
			return fmt.Errorf("store the photo of the identification: %w", err)
		}
		storedKey = &key
	}

	photoUsed := false
	err = s.inTx(ctx, "confirmation", func(tx pgx.Tx) error {
		queries := s.queries.WithTx(tx)
		row, err := queries.LockCandidate(ctx, biometricsdb.LockCandidateParams{
			CandidateID:      candidateID,
			IdentificationID: identificationID,
		})
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrIdentificationNotFound
		}
		if err != nil {
			return fmt.Errorf("lock the candidate of the confirmation: %w", err)
		}
		// RN-65: a foto fica a da primeira confirmação que envia uma foto.
		// The identification is locked, so no other confirmation sets a
		// photo between this check and the update.
		photoUsed = storedKey != nil && row.PhotoKey == nil
		err = queries.SetIdentificationContact(ctx, biometricsdb.SetIdentificationContactParams{
			ID:             identificationID,
			ContactName:    &contact.Name,
			ContactPhone:   &contact.Phone,
			ContactMessage: contact.Message,
			PhotoKey:       storedKey,
		})
		if err != nil {
			return fmt.Errorf("set the contact of the identification: %w", err)
		}
		confirmed, err := queries.ConfirmCandidate(ctx, row.ID)
		if err != nil {
			return fmt.Errorf("confirm candidate: %w", err)
		}
		if confirmed == 0 {
			// RN-65: a confirmação de novo muda só o contato, sem nova notificação.
			return nil
		}
		// RN-16: o tutor do pet confirmado recebe uma notificação.
		return alerts.EnqueueFound(ctx, tx, alerts.Found{
			CandidateID: row.ID,
			OwnerID:     row.OwnerID,
			PetName:     row.PetName,
			ContactName: contact.Name,
		})
	})
	if storedKey != nil && (err != nil || !photoUsed) {
		// No identification points to the object. The delete continues
		// when the client ends the request.
		if derr := s.photos.Delete(context.WithoutCancel(ctx), *storedKey); derr != nil {
			s.logger.ErrorContext(ctx, "delete the photo of a confirmation that does not use it",
				slog.String("key", *storedKey), slog.Any("error", derr))
		}
	}
	return err
}

// FoundNotices returns the confirmations of the pets of the owner that
// made the request, from the newest to the oldest (RN-66).
func (s *Service) FoundNotices(ctx context.Context) ([]FoundNotice, error) {
	owner, err := s.owners.CurrentOwner(ctx)
	if err != nil {
		return nil, fmt.Errorf("find the owner of the request: %w", err)
	}
	rows, err := s.queries.ListFoundNotices(ctx, owner.ID)
	if err != nil {
		return nil, fmt.Errorf("list found notices: %w", err)
	}
	notices := make([]FoundNotice, 0, len(rows))
	for _, row := range rows {
		// The query gives only confirmed candidates, and a confirmation
		// always sets the name, the phone and the date.
		if row.ContactName == nil || row.ContactPhone == nil || row.ConfirmedAt == nil {
			return nil, fmt.Errorf("found notice %s has no contact or no date", row.ID)
		}
		notice := FoundNotice{
			ID:      row.ID,
			PetID:   row.PetID,
			PetName: row.PetName,
			Contact: Contact{
				Name:    *row.ContactName,
				Phone:   *row.ContactPhone,
				Message: row.ContactMessage,
			},
			ConfirmedAt: *row.ConfirmedAt,
		}
		if row.HasLocation {
			notice.Location = &Location{Latitude: row.Latitude, Longitude: row.Longitude}
		}
		notices = append(notices, notice)
	}
	return notices, nil
}

// inTx runs work in a transaction, and commits when work returns nil. name
// says what the transaction is for, in the errors.
func (s *Service) inTx(ctx context.Context, name string, work func(tx pgx.Tx) error) (err error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin the %s transaction: %w", name, err)
	}
	defer func() {
		// After Commit, Rollback returns pgx.ErrTxClosed and does nothing.
		rerr := tx.Rollback(context.WithoutCancel(ctx))
		if rerr != nil && !errors.Is(rerr, pgx.ErrTxClosed) && err == nil {
			err = fmt.Errorf("roll back the %s transaction: %w", name, rerr)
		}
	}()
	if err := work(tx); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit the %s transaction: %w", name, err)
	}
	return nil
}

// validateContact applies RN-63 and returns the contact without the spaces
// around the texts.
func validateContact(contact Contact) (Contact, error) {
	invalid := func(message string) (Contact, error) {
		return Contact{}, &ValidationError{Message: message}
	}
	contact.Name = strings.TrimSpace(contact.Name)
	if contact.Name == "" {
		return invalid("name is required")
	}
	if utf8.RuneCountInString(contact.Name) > _maxContactNameLength {
		return invalid("name must have at most 120 characters")
	}
	contact.Phone = strings.TrimSpace(contact.Phone)
	if !_phonePattern.MatchString(contact.Phone) {
		return invalid("phone must have from 8 to 30 characters: digits, space, +, -, ( and )")
	}
	if contact.Message != nil {
		message := strings.TrimSpace(*contact.Message)
		if utf8.RuneCountInString(message) > _maxContactMessageLength {
			return invalid("message must have at most 500 characters")
		}
		contact.Message = &message
		if message == "" {
			contact.Message = nil
		}
	}
	return contact, nil
}
