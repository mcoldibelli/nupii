package httpx_test

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mcoldibelli/nupii/backend/internal/platform/httpx"
)

// logLines decodes the JSON lines that the logger wrote to buf.
func logLines(t *testing.T, buf *bytes.Buffer) []map[string]any {
	t.Helper()
	var lines []map[string]any
	dec := json.NewDecoder(buf)
	for dec.More() {
		var line map[string]any
		if err := dec.Decode(&line); err != nil {
			t.Fatalf("decode log line: %v", err)
		}
		lines = append(lines, line)
	}
	return lines
}

// RNF-07: each request has an identifier, and the identifier is in all the
// log lines of that request.
func TestRequestLog(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(httpx.NewLogHandler(slog.NewJSONHandler(&buf, nil)))
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		logger.InfoContext(r.Context(), "inside handler")
		w.WriteHeader(http.StatusTeapot)
	})
	handler := httpx.RequestLog(logger)(inner)

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/v1/anything", nil))

	id := rec.Header().Get(httpx.RequestIDHeader)
	if id == "" {
		t.Fatalf("response has no %s header", httpx.RequestIDHeader)
	}
	lines := logLines(t, &buf)
	if len(lines) != 2 {
		t.Fatalf("got %d log lines, want 2: %v", len(lines), lines)
	}
	for _, line := range lines {
		if line["request_id"] != id {
			t.Errorf("log line %q has request_id %v, want %q", line["msg"], line["request_id"], id)
		}
	}
	access := lines[1]
	if access["method"] != http.MethodGet || access["path"] != "/v1/anything" || access["status"] != float64(http.StatusTeapot) {
		t.Errorf("access log line = %v, want method GET, path /v1/anything, status 418", access)
	}
}

func TestRequestLogGivesEachRequestADifferentID(t *testing.T) {
	logger := slog.New(slog.DiscardHandler)
	handler := httpx.RequestLog(logger)(http.NotFoundHandler())

	first, second := httptest.NewRecorder(), httptest.NewRecorder()
	handler.ServeHTTP(first, httptest.NewRequest(http.MethodGet, "/", nil))
	handler.ServeHTTP(second, httptest.NewRequest(http.MethodGet, "/", nil))

	a, b := first.Header().Get(httpx.RequestIDHeader), second.Header().Get(httpx.RequestIDHeader)
	if a == "" || a == b {
		t.Errorf("request ids = %q and %q, want two different values", a, b)
	}
}
