package main

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/getkin/kin-openapi/routers/legacy"
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

func TestGetHealth(t *testing.T) {
	handler := newHandler(slog.New(slog.DiscardHandler))
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

// freeAddr returns a local address with a port that is free now.
func freeAddr(t *testing.T) string {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen on a free port: %v", err)
	}
	addr := ln.Addr().String()
	if err := ln.Close(); err != nil {
		t.Fatalf("close listener: %v", err)
	}
	return addr
}

func TestRunServesUntilTheContextIsCanceled(t *testing.T) {
	addr := freeAddr(t)
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	getenv := func(key string) string {
		if key == "HTTP_ADDR" {
			return addr
		}
		return ""
	}
	done := make(chan error, 1)
	go func() { done <- run(ctx, getenv, io.Discard) }()

	url := "http://" + addr + "/v1/health"
	deadline := time.Now().Add(5 * time.Second)
	for {
		resp, err := http.Get(url)
		if err == nil {
			if cerr := resp.Body.Close(); cerr != nil {
				t.Fatalf("close response body: %v", cerr)
			}
			if resp.StatusCode != http.StatusOK {
				t.Fatalf("GET %s: status = %d, want 200", url, resp.StatusCode)
			}
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("GET %s: no answer in 5 seconds: %v", url, err)
		}
		time.Sleep(20 * time.Millisecond)
	}

	cancel()
	select {
	case err := <-done:
		if err != nil {
			t.Errorf("run after cancel: got %v, want nil", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("run did not return 5 seconds after the context was canceled")
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
