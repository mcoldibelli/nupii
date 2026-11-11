package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/getkin/kin-openapi/openapi3"

	"github.com/mcoldibelli/nupii/backend/internal/api"
	"github.com/mcoldibelli/nupii/backend/internal/platform/httpx"
)

// validateErrorBody fails the test if body is not valid for the Error
// schema of the contract. Use it for a response that has no operation in
// the contract, for example the 404 of a route that does not exist.
func validateErrorBody(t *testing.T, body []byte) {
	t.Helper()
	doc, err := openapi3.NewLoader().LoadFromFile(_contractPath)
	if err != nil {
		t.Fatalf("load contract: %v", err)
	}
	var value any
	if err := json.Unmarshal(body, &value); err != nil {
		t.Fatalf("decode body %q: %v", body, err)
	}
	if err := doc.Components.Schemas["Error"].Value.VisitJSON(value); err != nil {
		t.Errorf("body %q does not match the Error schema: %v", body, err)
	}
}

func TestUnknownRouteGetsNotFoundInTheErrorFormat(t *testing.T) {
	handler := newHandler(slog.New(slog.DiscardHandler), healthyServer())
	tests := []struct {
		name   string
		method string
		path   string
	}{
		{name: "path that is not in the contract", method: http.MethodGet, path: "/v1/unknown"},
		{name: "root path", method: http.MethodGet, path: "/"},
		{name: "wrong method on a path of the contract", method: http.MethodDelete, path: "/v1/health"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := httptest.NewRecorder()

			handler.ServeHTTP(rec, httptest.NewRequest(tt.method, tt.path, nil))

			if rec.Code != http.StatusNotFound {
				t.Errorf("status = %d, want 404", rec.Code)
			}
			if got := rec.Header().Get("Content-Type"); got != "application/json" {
				t.Errorf("Content-Type = %q, want application/json", got)
			}
			var body api.Error
			if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
				t.Fatalf("decode body %q: %v", rec.Body.String(), err)
			}
			if body.Error != api.NotFound {
				t.Errorf("error code = %q, want %q", body.Error, api.NotFound)
			}
			validateErrorBody(t, rec.Body.Bytes())
		})
	}
}

// failingOperations is an implementation of the contract whose operations
// return an error.
type failingOperations struct{}

const _internalDetail = "connection refused to 10.0.0.7:5432"

func (failingOperations) GetHealth(context.Context, api.GetHealthRequestObject) (api.GetHealthResponseObject, error) {
	return nil, errors.New(_internalDetail)
}

func TestOperationErrorGetsInternalErrorInTheErrorFormat(t *testing.T) {
	var logs bytes.Buffer
	logger := slog.New(httpx.NewLogHandler(slog.NewJSONHandler(&logs, nil)))
	handler := newHandler(logger, failingOperations{})
	req := httptest.NewRequest(http.MethodGet, "/v1/health", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", rec.Code)
	}
	var body api.Error
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode body %q: %v", rec.Body.String(), err)
	}
	if body.Error != api.InternalError {
		t.Errorf("error code = %q, want %q", body.Error, api.InternalError)
	}
	if strings.Contains(rec.Body.String(), _internalDetail) {
		t.Errorf("body %q has the internal detail of the error", rec.Body.String())
	}
	validateResponse(t, req, rec.Code, rec.Header(), rec.Body.Bytes())

	// The detail goes to the log, with the identifier of the request.
	id := rec.Header().Get(httpx.RequestIDHeader)
	if !strings.Contains(logs.String(), _internalDetail) || !strings.Contains(logs.String(), id) {
		t.Errorf("log does not have the error detail and the request id %q:\n%s", id, logs.String())
	}
}

// panickingOperations is an implementation of the contract whose operations
// panic.
type panickingOperations struct{}

func (panickingOperations) GetHealth(
	context.Context,
	api.GetHealthRequestObject,
) (api.GetHealthResponseObject, error) {
	panic("nil map write in the health handler")
}

// RNF-07: the identifier of the request is in all its log lines, also when
// a handler panics.
func TestHandlerPanicGetsInternalErrorAndKeepsTheRequestLog(t *testing.T) {
	var logs bytes.Buffer
	logger := slog.New(httpx.NewLogHandler(slog.NewJSONHandler(&logs, nil)))
	handler := newHandler(logger, panickingOperations{})
	req := httptest.NewRequest(http.MethodGet, "/v1/health", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", rec.Code)
	}
	var body api.Error
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode body %q: %v", rec.Body.String(), err)
	}
	if body.Error != api.InternalError {
		t.Errorf("error code = %q, want %q", body.Error, api.InternalError)
	}
	if strings.Contains(rec.Body.String(), "nil map write") {
		t.Errorf("body %q has the panic value", rec.Body.String())
	}
	validateResponse(t, req, rec.Code, rec.Header(), rec.Body.Bytes())

	id := rec.Header().Get(httpx.RequestIDHeader)
	var messages []string
	dec := json.NewDecoder(&logs)
	for dec.More() {
		var line map[string]any
		if err := dec.Decode(&line); err != nil {
			t.Fatalf("decode log line: %v", err)
		}
		if line["request_id"] != id {
			t.Errorf("log line %q has request_id %v, want %q", line["msg"], line["request_id"], id)
		}
		messages = append(messages, line["msg"].(string))
	}
	want := []string{"handler panic", "http request"}
	if len(messages) != len(want) || messages[0] != want[0] || messages[1] != want[1] {
		t.Errorf("log messages = %q, want %q", messages, want)
	}
}
