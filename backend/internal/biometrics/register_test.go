package biometrics

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"math"
	"strings"
	"testing"
	"time"

	"github.com/mcoldibelli/nupii/backend/internal/biometrics/biometricsdb"

	"github.com/mcoldibelli/nupii/backend/internal/pets"
	"github.com/mcoldibelli/nupii/backend/internal/platform/inference"
	"github.com/mcoldibelli/nupii/backend/internal/platform/storage"
)

const _jpeg = "\xFF\xD8\xFF\xE0 the photo of a nose"

// onePet gives the same pet for each identifier.
type onePet struct {
	species string
}

func (p onePet) Get(context.Context, string) (pets.Pet, error) {
	return pets.Pet{Input: pets.Input{Name: "Rex", Species: p.species}}, nil
}

// refusingEmbedder refuses each photo with err, and counts the calls.
type refusingEmbedder struct {
	err   error
	calls int
}

func (e *refusingEmbedder) Embed(context.Context, []byte) (inference.Embedding, error) {
	e.calls++
	return inference.Embedding{}, e.err
}

func (e *refusingEmbedder) ModelVersion(context.Context) (string, error) {
	return "test-model", nil
}

// spyStore records the keys of the objects that were stored.
type spyStore struct {
	stored []string
	// getErr is the error of each read of an object.
	getErr error
}

func (s *spyStore) Put(_ context.Context, key, _ string, _ io.Reader, _ int64) error {
	s.stored = append(s.stored, key)
	return nil
}

func (s *spyStore) Delete(context.Context, string) error { return nil }

func (s *spyStore) Get(context.Context, string, int64) ([]byte, error) { return nil, s.getErr }

func (s *spyStore) SignedURL(key string, _ time.Duration) (string, error) {
	return "http://store.test/" + key, nil
}

// The service has no database: these tests end before the first query.
func newTestService(species string, embedder Embedder, store PhotoStore) *Service {
	logger := slog.New(slog.DiscardHandler)
	return NewService(nil, nil, onePet{species: species}, embedder, store, logger)
}

func TestRegisterRefusesAPetThatIsNotADog(t *testing.T) {
	for _, species := range []string{"cat", "other"} {
		t.Run("RN-07 "+species, func(t *testing.T) {
			embedder, store := &refusingEmbedder{}, &spyStore{}
			service := newTestService(species, embedder, store)

			_, err := service.Register(t.Context(), "pet-id", strings.NewReader(_jpeg))

			if !errors.Is(err, ErrSpeciesNotSupported) {
				t.Errorf("Register error = %v, want ErrSpeciesNotSupported", err)
			}
			if embedder.calls != 0 || len(store.stored) != 0 {
				t.Errorf("%d calls of the inference service and %d stored photos, want none",
					embedder.calls, len(store.stored))
			}
		})
	}
}

func TestRegisterDoesNotStoreAPhotoThatTheInferenceRefuses(t *testing.T) {
	refusals := []error{
		inference.ErrLowQuality, inference.ErrFraming,
		inference.ErrInvalidImage, inference.ErrUnavailable,
	}
	for _, refusal := range refusals {
		t.Run("RN-08 "+refusal.Error(), func(t *testing.T) {
			embedder, store := &refusingEmbedder{err: refusal}, &spyStore{}
			service := newTestService("dog", embedder, store)

			_, err := service.Register(t.Context(), "pet-id", strings.NewReader(_jpeg))

			if !errors.Is(err, refusal) {
				t.Errorf("Register error = %v, want %v", err, refusal)
			}
			if embedder.calls != 1 || len(store.stored) != 0 {
				t.Errorf("%d calls of the inference service and %d stored photos, want 1 and 0",
					embedder.calls, len(store.stored))
			}
		})
	}
}

func TestRegisterRefusesAPhotoThatIsNotAnAcceptedImage(t *testing.T) {
	tests := []struct {
		name  string
		photo io.Reader
	}{
		{name: "RN-59 text file", photo: strings.NewReader("this is a text file")},
		{name: "RN-59 image with more than 8 MB", photo: io.MultiReader(
			strings.NewReader(_jpeg), strings.NewReader(strings.Repeat("x", 8<<20)))},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			embedder, store := &refusingEmbedder{}, &spyStore{}
			service := newTestService("dog", embedder, store)

			_, err := service.Register(t.Context(), "pet-id", tt.photo)

			if _, ok := errors.AsType[*ValidationError](err); !ok {
				t.Errorf("Register error = %v, want a ValidationError", err)
			}
			if embedder.calls != 0 {
				t.Errorf("%d calls of the inference service, want none", embedder.calls)
			}
		})
	}
}

// RN-61: a latitude e a longitude são de um ponto da Terra.
func TestIdentifyRefusesALocationThatIsNotAPoint(t *testing.T) {
	tests := []struct {
		name     string
		location Location
	}{
		{name: "latitude over 90", location: Location{Latitude: 90.5, Longitude: 1}},
		{name: "longitude under -180", location: Location{Latitude: 1, Longitude: -180.5}},
		{name: "latitude that is not a number", location: Location{Latitude: math.NaN(), Longitude: 1}},
		{name: "longitude that is not a number", location: Location{Latitude: 1, Longitude: math.NaN()}},
		{name: "infinite latitude", location: Location{Latitude: math.Inf(1), Longitude: 1}},
	}
	for _, tt := range tests {
		t.Run("RN-61 "+tt.name, func(t *testing.T) {
			embedder := &refusingEmbedder{}
			service := newTestService("dog", embedder, &spyStore{})

			_, err := service.Identify(t.Context(), []byte(_jpeg), &tt.location)

			if _, ok := errors.AsType[*ValidationError](err); !ok {
				t.Errorf("Identify error = %v, want a ValidationError", err)
			}
			if embedder.calls != 0 {
				t.Errorf("%d calls of the inference service, want none", embedder.calls)
			}
		})
	}
}

// RN-59: a foto do focinho tem até 8 MB.
func TestCheckPhotoAcceptsExactly8MB(t *testing.T) {
	photo := make([]byte, 8<<20)
	copy(photo, _jpeg)

	if _, _, err := checkPhoto(photo); err != nil {
		t.Errorf("photo with 8 MB: %v, want no error", err)
	}
	if _, _, err := checkPhoto(append(photo, 0)); err == nil {
		t.Error("photo with 8 MB and 1 byte: no error")
	}
}

// RN-67: only a photo that does not exist is skipped. With another failure
// of the store, the recompute stops.
func TestReembedOfOneNoseprintTellsAMissingPhotoFromAStoreFailure(t *testing.T) {
	row := biometricsdb.ListNoseprintsOfOtherVersionsRow{ID: "id", ImageKey: "key", ModelVersion: "old"}

	missing := newTestService("dog", &refusingEmbedder{}, &spyStore{getErr: storage.ErrNotFound})
	if _, err := missing.reembed(t.Context(), row); !errors.Is(err, errPhotoNotUsable) {
		t.Errorf("photo that does not exist: error = %v, want errPhotoNotUsable", err)
	}

	failure := errors.New("the store does not respond")
	failing := newTestService("dog", &refusingEmbedder{}, &spyStore{getErr: failure})
	_, err := failing.reembed(t.Context(), row)
	if !errors.Is(err, failure) || errors.Is(err, errPhotoNotUsable) {
		t.Errorf("store failure: error = %v, want the failure, not errPhotoNotUsable", err)
	}
}
