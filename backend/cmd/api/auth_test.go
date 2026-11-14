package main

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/getkin/kin-openapi/openapi3"

	"github.com/mcoldibelli/nupii/backend/internal/api"
	"github.com/mcoldibelli/nupii/backend/internal/identity"
)

// RN-46: uma chamada sem token, com token inválido ou com token vencido
// recebe 401.
func TestProtectedRouteWithoutAValidTokenGetsUnauthenticated(t *testing.T) {
	verifier := fakeVerifier{identities: map[string]identity.Identity{
		"valid-token": {UID: "uid-1", Email: "tutor@example.com"},
	}}
	handler := newHandler(slog.New(slog.DiscardHandler), healthyServer(), verifier, noDeletedAccounts{}, nil, nil)
	tests := []struct {
		name          string
		authorization string
	}{
		{name: "RN-46 no Authorization header", authorization: ""},
		{name: "RN-46 scheme that is not Bearer", authorization: "Basic dXNlcjpwYXNz"},
		{name: "RN-46 Bearer without a token", authorization: "Bearer "},
		{name: "RN-46 token that the verifier rejects", authorization: "Bearer expired-token"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/v1/me", nil)
			if tt.authorization != "" {
				req.Header.Set("Authorization", tt.authorization)
			}
			rec := httptest.NewRecorder()

			handler.ServeHTTP(rec, req)

			if rec.Code != http.StatusUnauthorized {
				t.Fatalf("status = %d, want 401", rec.Code)
			}
			if got := rec.Header().Get("WWW-Authenticate"); got != "Bearer" {
				t.Errorf("WWW-Authenticate = %q, want Bearer", got)
			}
			var body api.Error
			if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
				t.Fatalf("decode body %q: %v", rec.Body.String(), err)
			}
			if body.Error != api.ErrorCodeUnauthenticated {
				t.Errorf("error code = %q, want %q", body.Error, api.ErrorCodeUnauthenticated)
			}
			validateResponse(t, req, rec.Code, rec.Header(), rec.Body.Bytes())
		})
	}
}

func TestVerifierFailureGetsInternalError(t *testing.T) {
	const detail = "dial tcp 10.0.0.9:443: i/o timeout"
	verifier := fakeVerifier{err: errors.New(detail)}
	handler := newHandler(slog.New(slog.DiscardHandler), healthyServer(), verifier, noDeletedAccounts{}, nil, nil)
	req := httptest.NewRequest(http.MethodGet, "/v1/me", nil)
	req.Header.Set("Authorization", "Bearer any-token")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", rec.Code)
	}
	if strings.Contains(rec.Body.String(), detail) {
		t.Errorf("body %q has the internal detail of the error", rec.Body.String())
	}
	validateResponse(t, req, rec.Code, rec.Header(), rec.Body.Bytes())
}

func TestPublicRouteNeedsNoToken(t *testing.T) {
	handler := newHandler(slog.New(slog.DiscardHandler), healthyServer(), fakeVerifier{}, noDeletedAccounts{}, nil, nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/v1/health", nil))

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200", rec.Code)
	}
}

// The contract is the source: an operation without "security" is public,
// and every other operation needs a token.
func TestIsPublicMatchesTheContract(t *testing.T) {
	doc, err := openapi3.NewLoader().LoadFromFile(_contractPath)
	if err != nil {
		t.Fatalf("load contract: %v", err)
	}
	operations := 0
	for path, item := range doc.Paths.Map() {
		for method, operation := range item.Operations() {
			operations++
			wantPublic := operation.Security == nil || len(*operation.Security) == 0
			req := httptest.NewRequest(method, path, nil)
			req.Pattern = method + " " + path
			if got := isPublic(req); got != wantPublic {
				t.Errorf("isPublic(%s %s) = %t, but the contract says public = %t", method, path, got, wantPublic)
			}
		}
	}
	if operations == 0 {
		t.Fatal("the contract has no operation")
	}
}

// A request body has a size limit. The handler is not called for a body
// over the limit: healthyServer has no handler for this route.
func TestRequestBodyOverTheLimitGetsInvalidRequest(t *testing.T) {
	verifier := fakeVerifier{identities: map[string]identity.Identity{
		"valid-token": {UID: "uid-1", Email: "tutor@example.com"},
	}}
	handler := newHandler(slog.New(slog.DiscardHandler), healthyServer(), verifier, noDeletedAccounts{}, nil, nil)
	body := `{"name": "` + strings.Repeat("a", _maxBodyBytes) + `", "acceptedTermsVersion": "x"}`
	req := httptest.NewRequest(http.MethodPost, "/v1/me", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer valid-token")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400, body %s", rec.Code, rec.Body)
	}
	var got api.Error
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode body %q: %v", rec.Body.String(), err)
	}
	if got.Error != api.ErrorCodeInvalidRequest {
		t.Errorf("error code = %q, want %q", got.Error, api.ErrorCodeInvalidRequest)
	}
}

// The public web page runs in a browser, at another origin. The browser
// gives the answer to the page only with this header.
func TestOnlyPublicRoutesAllowOtherOrigins(t *testing.T) {
	handler := newHandler(slog.New(slog.DiscardHandler), healthyServer(), fakeVerifier{}, noDeletedAccounts{}, nil, nil)
	tests := []struct {
		method string
		path   string
		want   string
	}{
		{method: http.MethodGet, path: "/v1/health", want: "*"},
		// The request has no body, so the answer is an error. The header
		// is in the answer of an error too.
		{method: http.MethodPost, path: "/v1/identifications", want: "*"},
		{method: http.MethodGet, path: "/v1/me", want: ""},
		{method: http.MethodGet, path: "/v1/unknown", want: ""},
	}
	for _, tt := range tests {
		t.Run(tt.method+" "+tt.path, func(t *testing.T) {
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, httptest.NewRequest(tt.method, tt.path, nil))

			if got := rec.Header().Get("Access-Control-Allow-Origin"); got != tt.want {
				t.Errorf("Access-Control-Allow-Origin = %q, want %q", got, tt.want)
			}
		})
	}
}

// The public web page sends JSON to a public route of another origin. The
// browser first sends a preflight request with the method OPTIONS.
func TestPreflightOfPublicRoutes(t *testing.T) {
	handler := newHandler(slog.New(slog.DiscardHandler), healthyServer(), fakeVerifier{}, noDeletedAccounts{}, nil, nil)
	const sightings = "/v1/reports/0195f3c8-7a55-7c1e-9d2a-0d1c2b3a4f5e/sightings"
	tests := []struct {
		name       string
		path       string
		method     string
		wantStatus int
	}{
		{name: "public route", path: sightings, method: http.MethodPost, wantStatus: http.StatusNoContent},
		{name: "route with a token", path: "/v1/reports/lost", method: http.MethodPost, wantStatus: http.StatusNotFound},
		{name: "method that the route does not have", path: sightings, method: http.MethodDelete, wantStatus: http.StatusNotFound},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodOptions, tt.path, nil)
			req.Header.Set("Origin", "http://localhost:8081")
			req.Header.Set("Access-Control-Request-Method", tt.method)
			req.Header.Set("Access-Control-Request-Headers", "content-type")
			rec := httptest.NewRecorder()

			handler.ServeHTTP(rec, req)

			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d", rec.Code, tt.wantStatus)
			}
			if tt.wantStatus != http.StatusNoContent {
				return
			}
			header := rec.Header()
			if header.Get("Access-Control-Allow-Origin") != "*" ||
				header.Get("Access-Control-Allow-Methods") != tt.method ||
				header.Get("Access-Control-Allow-Headers") != "Content-Type" {
				t.Errorf("headers = %v, want the origin *, the method and Content-Type", header)
			}
		})
	}
}

// ADR 0029, item 8: the web with an account calls the routes with a token
// from another origin. Only the origins of WEB_ORIGINS get the answer.
func TestWebOriginsReachRoutesWithAToken(t *testing.T) {
	const web = "https://app.nupii.com.br"
	handler := newHandler(slog.New(slog.DiscardHandler), healthyServer(), fakeVerifier{}, noDeletedAccounts{}, []string{web}, nil)
	tests := []struct {
		name       string
		origin     string
		path       string
		wantOrigin string
	}{
		// Without a token the answer is 401, and the page must read it.
		{name: "allowed origin", origin: web, path: "/v1/me", wantOrigin: web},
		{name: "other origin", origin: "https://evil.example", path: "/v1/me", wantOrigin: ""},
		{name: "public route keeps *", origin: web, path: "/v1/health", wantOrigin: "*"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, tt.path, nil)
			req.Header.Set("Origin", tt.origin)
			rec := httptest.NewRecorder()

			handler.ServeHTTP(rec, req)

			if got := rec.Header().Get("Access-Control-Allow-Origin"); got != tt.wantOrigin {
				t.Errorf("Access-Control-Allow-Origin = %q, want %q", got, tt.wantOrigin)
			}
			if tt.wantOrigin == web && rec.Header().Get("Vary") != "Origin" {
				t.Errorf("Vary = %q, want Origin", rec.Header().Get("Vary"))
			}
		})
	}
}

// The browser sends a preflight before a request with the Authorization
// header. An allowed origin gets it for a route with a token.
func TestPreflightOfRoutesWithAToken(t *testing.T) {
	const web = "https://app.nupii.com.br"
	handler := newHandler(slog.New(slog.DiscardHandler), healthyServer(), fakeVerifier{}, noDeletedAccounts{}, []string{web}, nil)
	tests := []struct {
		name       string
		origin     string
		path       string
		method     string
		wantStatus int
	}{
		{name: "allowed origin", origin: web, path: "/v1/me", method: http.MethodGet, wantStatus: http.StatusNoContent},
		{name: "other origin", origin: "https://evil.example", path: "/v1/me", method: http.MethodGet, wantStatus: http.StatusNotFound},
		{name: "route that does not exist", origin: web, path: "/v1/unknown", method: http.MethodGet, wantStatus: http.StatusNotFound},
		{name: "method that the route does not have", origin: web, path: "/v1/me", method: http.MethodPut, wantStatus: http.StatusNotFound},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodOptions, tt.path, nil)
			req.Header.Set("Origin", tt.origin)
			req.Header.Set("Access-Control-Request-Method", tt.method)
			req.Header.Set("Access-Control-Request-Headers", "authorization")
			rec := httptest.NewRecorder()

			handler.ServeHTTP(rec, req)

			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d", rec.Code, tt.wantStatus)
			}
			if tt.wantStatus != http.StatusNoContent {
				return
			}
			header := rec.Header()
			if header.Get("Access-Control-Allow-Origin") != web ||
				header.Get("Access-Control-Allow-Methods") != tt.method ||
				header.Get("Access-Control-Allow-Headers") != "Authorization, Content-Type" ||
				header.Get("Vary") != "Origin" {
				t.Errorf("headers = %v, want the origin, the method, Authorization and Vary", header)
			}
		})
	}
}
