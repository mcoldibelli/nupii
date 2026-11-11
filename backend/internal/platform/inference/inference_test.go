package inference

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/mcoldibelli/nupii/backend/internal/platform/httpx"
)

// serviceThatAnswers returns a client of a test server that answers each
// request with status and body.
func serviceThatAnswers(t *testing.T, status int, body string) *Client {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(status)
		if _, err := io.WriteString(w, body); err != nil {
			t.Errorf("write answer: %v", err)
		}
	}))
	t.Cleanup(srv.Close)
	return New(srv.URL)
}

func embeddingBody(dimensions int) string {
	vector := make([]float32, dimensions)
	vector[0] = 1
	body, err := json.Marshal(map[string]any{
		"embedding": vector, "modelVersion": "tinyvit21m-s43", "quality": 0.8731,
	})
	if err != nil {
		panic(err)
	}
	return string(body)
}

func TestEmbedSendsTheImageAndReadsTheVector(t *testing.T) {
	var gotPath, gotBody string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Errorf("read request: %v", err)
		}
		gotPath, gotBody = r.Method+" "+r.URL.Path, string(body)
		if _, err := io.WriteString(w, embeddingBody(512)); err != nil {
			t.Errorf("write answer: %v", err)
		}
	}))
	defer srv.Close()

	got, err := New(srv.URL).Embed(t.Context(), []byte("the photo"))
	if err != nil {
		t.Fatalf("Embed: %v", err)
	}
	if gotPath != "POST /v1/nose/embedding" || gotBody != "the photo" {
		t.Errorf("request = %q with body %q, want POST /v1/nose/embedding with the photo", gotPath, gotBody)
	}
	// RN-18: a saída tem o vetor de 512 dimensões, a versão do modelo e a nitidez.
	if len(got.Vector) != 512 || got.Vector[0] != 1 {
		t.Errorf("vector has %d dimensions, want 512 with the first value 1", len(got.Vector))
	}
	if got.ModelVersion != "tinyvit21m-s43" || got.Quality != 0.8731 {
		t.Errorf("model version %q and quality %v, want tinyvit21m-s43 and 0.8731",
			got.ModelVersion, got.Quality)
	}
}

func TestEmbedGivesAnErrorForEachRefusal(t *testing.T) {
	tests := []struct {
		name   string
		status int
		body   string
		want   error
	}{
		{name: "RN-17 not an image", status: 400, body: `{"error":"image_invalid","message":"m"}`, want: ErrInvalidImage},
		{name: "RN-17 too large", status: 413, body: `{"error":"image_too_large","message":"m"}`, want: ErrInvalidImage},
		{name: "RN-20 no sharpness", status: 422, body: `{"error":"image_low_quality","message":"m"}`, want: ErrLowQuality},
		{name: "RN-21 no nose", status: 422, body: `{"error":"image_framing","message":"m"}`, want: ErrFraming},
		{name: "failure of the service", status: 500, body: `{"error":"internal_error","message":"m"}`, want: ErrUnavailable},
		{name: "refusal with an unknown code", status: 422, body: `{"error":"other","message":"m"}`, want: ErrUnavailable},
		{name: "answer that is not JSON", status: 200, body: `<html>`, want: ErrUnavailable},
		{name: "vector with another size", status: 200, body: embeddingBody(256), want: ErrUnavailable},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := serviceThatAnswers(t, tt.status, tt.body).Embed(t.Context(), []byte("photo"))
			if !errors.Is(err, tt.want) {
				t.Errorf("Embed error = %v, want %v", err, tt.want)
			}
		})
	}
}

func TestEmbedGivesUnavailableWhenTheServiceDoesNotAnswer(t *testing.T) {
	srv := httptest.NewServer(http.NotFoundHandler())
	srv.Close()

	_, err := New(srv.URL).Embed(t.Context(), []byte("photo"))
	if !errors.Is(err, ErrUnavailable) {
		t.Errorf("Embed error = %v, want ErrUnavailable", err)
	}
	if strings.Contains(err.Error(), "photo") {
		t.Errorf("the error has the content of the photo: %v", err)
	}
}

func TestModelVersion(t *testing.T) {
	client := serviceThatAnswers(t, 200, `{"modelVersion":"tinyvit21m-s43","dimensions":512}`)

	got, err := client.ModelVersion(t.Context())
	if err != nil || got != "tinyvit21m-s43" {
		t.Errorf("ModelVersion = %q, %v, want tinyvit21m-s43", got, err)
	}
}

// RNF-07: as linhas de log dos dois serviços têm o mesmo identificador.
func TestCallSendsTheRequestIDOfTheAPI(t *testing.T) {
	var gotID string
	service := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotID = r.Header.Get(httpx.RequestIDHeader)
		if _, err := io.WriteString(w, `{"modelVersion":"tinyvit21m-s43"}`); err != nil {
			t.Errorf("write answer: %v", err)
		}
	}))
	defer service.Close()
	client := New(service.URL)
	// A handler of the API that calls the service with the context of its request.
	handler := httpx.RequestLog(slog.New(slog.DiscardHandler))(http.HandlerFunc(
		func(_ http.ResponseWriter, r *http.Request) {
			if _, err := client.ModelVersion(r.Context()); err != nil {
				t.Errorf("ModelVersion: %v", err)
			}
		}))

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))

	if want := rec.Header().Get(httpx.RequestIDHeader); gotID == "" || gotID != want {
		t.Errorf("the service got the request id %q, want %q", gotID, want)
	}
}

// A request that the client of the API cancelled is not a failure of the
// inference service.
func TestEmbedOfACancelledRequestIsNotUnavailable(t *testing.T) {
	client := serviceThatAnswers(t, 200, embeddingBody(512))
	ctx, cancel := context.WithCancel(t.Context())
	cancel()

	_, err := client.Embed(ctx, []byte("photo"))
	if !errors.Is(err, context.Canceled) || errors.Is(err, ErrUnavailable) {
		t.Errorf("Embed error = %v, want context.Canceled and not ErrUnavailable", err)
	}
}
