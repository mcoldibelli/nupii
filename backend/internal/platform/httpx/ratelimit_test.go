package httpx

import (
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// limitedMux returns a handler with two POST routes and one GET route behind
// the rate limit of RN-43, and the clock that the limit reads.
func limitedMux(t *testing.T) (http.Handler, *time.Time) {
	t.Helper()
	now := time.Date(2026, 11, 11, 12, 0, 0, 0, time.UTC)
	limit := RateLimit(slog.New(slog.DiscardHandler), 10, time.Minute,
		func(r *http.Request) bool { return r.Method == http.MethodPost },
		func() time.Time { return now })
	ok := limit(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	mux := http.NewServeMux()
	mux.Handle("POST /v1/identifications", ok)
	mux.Handle("POST /v1/identifications/{id}/confirmation", ok)
	mux.Handle("GET /v1/health", ok)
	return mux, &now
}

func status(handler http.Handler, method, path, remoteAddr string) int {
	req := httptest.NewRequest(method, path, nil)
	req.RemoteAddr = remoteAddr
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec.Code
}

// RN-43: um endpoint público aceita no máximo 10 POST por minuto, por IP e
// por caminho.
func TestRateLimit(t *testing.T) {
	handler, now := limitedMux(t)
	const ana, bia = "203.0.113.1:5000", "203.0.113.2:5000"

	for i := range 10 {
		if got := status(handler, http.MethodPost, "/v1/identifications", ana); got != http.StatusNoContent {
			t.Fatalf("request %d: status = %d, want 204", i+1, got)
		}
	}
	if got := status(handler, http.MethodPost, "/v1/identifications", ana); got != http.StatusTooManyRequests {
		t.Errorf("request 11 in the same minute: status = %d, want 429", got)
	}
	// The port of the client is not part of the address.
	if got := status(handler, http.MethodPost, "/v1/identifications", "203.0.113.1:6000"); got != http.StatusTooManyRequests {
		t.Errorf("request 12, from another port of the same address: status = %d, want 429", got)
	}

	if got := status(handler, http.MethodPost, "/v1/identifications", bia); got != http.StatusNoContent {
		t.Errorf("another address: status = %d, want 204", got)
	}
	// Two identifications have two paths and one route: the limit is for the route.
	for _, id := range []string{"a", "b"} {
		path := "/v1/identifications/" + id + "/confirmation"
		if got := status(handler, http.MethodPost, path, ana); got != http.StatusNoContent {
			t.Errorf("another route, %s: status = %d, want 204", path, got)
		}
	}
	for i := range 20 {
		if got := status(handler, http.MethodGet, "/v1/health", ana); got != http.StatusNoContent {
			t.Fatalf("GET %d, which has no limit: status = %d, want 204", i+1, got)
		}
	}

	*now = now.Add(time.Minute)
	if got := status(handler, http.MethodPost, "/v1/identifications", ana); got != http.StatusNoContent {
		t.Errorf("first request of the next minute: status = %d, want 204", got)
	}
}

func TestRateLimitAnswersWithTheErrorFormat(t *testing.T) {
	handler, _ := limitedMux(t)
	for range 10 {
		status(handler, http.MethodPost, "/v1/identifications", "203.0.113.1:5000")
	}
	req := httptest.NewRequest(http.MethodPost, "/v1/identifications", nil)
	req.RemoteAddr = "203.0.113.1:5000"
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if body := rec.Body.String(); !strings.Contains(body, `"error":"rate_limited"`) {
		t.Errorf("body = %s, want the error code rate_limited", body)
	}
}
