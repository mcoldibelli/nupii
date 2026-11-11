package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/getkin/kin-openapi/routers/legacy"

	"github.com/mcoldibelli/nupii/backend/internal/api"
	"github.com/mcoldibelli/nupii/backend/internal/platform/httpx"
)

// contractPath is the contract file, relative to this package.
const contractPath = "../../../api/openapi.yaml"

// validateResponse fails the test if the recorded response is not a
// response that the contract declares for the request (RNF-08).
func validateResponse(t *testing.T, req *http.Request, rec *httptest.ResponseRecorder) {
	t.Helper()
	doc, err := openapi3.NewLoader().LoadFromFile(contractPath)
	if err != nil {
		t.Fatalf("load contract: %v", err)
	}
	router, err := legacy.NewRouter(doc)
	if err != nil {
		t.Fatalf("build contract router: %v", err)
	}
	route, pathParams, err := router.FindRoute(req)
	if err != nil {
		t.Fatalf("find %s %s in the contract: %v", req.Method, req.URL.Path, err)
	}
	input := &openapi3filter.ResponseValidationInput{
		RequestValidationInput: &openapi3filter.RequestValidationInput{
			Request:    req,
			PathParams: pathParams,
			Route:      route,
		},
		Status:  rec.Code,
		Header:  rec.Header(),
		Options: &openapi3filter.Options{IncludeResponseStatus: true},
	}
	input.SetBodyBytes(rec.Body.Bytes())
	if err := openapi3filter.ValidateResponse(t.Context(), input); err != nil {
		t.Errorf("response does not match the contract: %v", err)
	}
}

// fakeDatabase is a database that answers Ping with err.
type fakeDatabase struct {
	err error
}

func (d fakeDatabase) Ping(context.Context) error { return d.err }

// healthyServer returns the operations of the contract with a database
// that responds.
func healthyServer() server {
	return server{logger: slog.New(slog.DiscardHandler), database: fakeDatabase{}}
}

func TestGetHealth(t *testing.T) {
	handler := newHandler(slog.New(slog.DiscardHandler), healthyServer())
	req := httptest.NewRequest(http.MethodGet, "/v1/health", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode body %q: %v", rec.Body.String(), err)
	}
	if body["status"] != "ok" {
		t.Errorf(`body["status"] = %v, want "ok"`, body["status"])
	}
	validateResponse(t, req, rec)
}

func TestGetHealthWhenTheDatabaseDoesNotRespond(t *testing.T) {
	const detail = "dial tcp 10.0.0.7:5432: connect: connection refused"
	var logs bytes.Buffer
	logger := slog.New(httpx.NewLogHandler(slog.NewJSONHandler(&logs, nil)))
	operations := server{logger: logger, database: fakeDatabase{err: errors.New(detail)}}
	handler := newHandler(logger, operations)
	req := httptest.NewRequest(http.MethodGet, "/v1/health", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", rec.Code)
	}
	var body api.Error
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode body %q: %v", rec.Body.String(), err)
	}
	if body.Error != api.Unavailable {
		t.Errorf("error code = %q, want %q", body.Error, api.Unavailable)
	}
	if strings.Contains(rec.Body.String(), detail) {
		t.Errorf("body %q has the internal detail of the error", rec.Body.String())
	}
	validateResponse(t, req, rec)
	if !strings.Contains(logs.String(), detail) {
		t.Errorf("log does not have the cause of the failure:\n%s", logs.String())
	}
}

// RNF-06: the process does not start with an invalid configuration.
func TestRunFailsWithInvalidConfiguration(t *testing.T) {
	getenv := func(string) string { return "not-an-address" }

	err := run(t.Context(), getenv, io.Discard)

	if err == nil {
		t.Fatal("run with an invalid HTTP_ADDR: got nil error, want an error")
	}
	if _, ok := errors.AsType[*net.AddrError](err); !ok {
		t.Errorf("run error = %v, want it to wrap the address error", err)
	}
}
