package biometrics

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"strings"
	"testing"
	"time"

	"github.com/mcoldibelli/nupii/backend/internal/pets"
	"github.com/mcoldibelli/nupii/backend/internal/platform/inference"
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

// spyStore records the keys of the objects that were stored.
type spyStore struct {
	stored []string
}

func (s *spyStore) Put(_ context.Context, key, _ string, _ io.Reader, _ int64) error {
	s.stored = append(s.stored, key)
	return nil
}

func (s *spyStore) Delete(context.Context, string) error { return nil }

func (s *spyStore) SignedURL(key string, _ time.Duration) (string, error) {
	return "http://store.test/" + key, nil
}

// The service has no database: these tests end before the first query.
func newTestService(species string, embedder Embedder, store PhotoStore) *Service {
	return NewService(nil, onePet{species: species}, embedder, store, slog.New(slog.DiscardHandler))
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
