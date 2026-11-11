//go:build integration

package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mcoldibelli/nupii/backend/internal/api"
	"github.com/mcoldibelli/nupii/backend/internal/identity"
	"github.com/mcoldibelli/nupii/backend/internal/platform/firebase"
	"github.com/mcoldibelli/nupii/backend/internal/platform/postgres/postgrestest"
)

// ownerAPI is the handler of the API with the real database, for one test.
type ownerAPI struct {
	t       *testing.T
	handler http.Handler
}

// newOwnerAPI returns the API with the database of the local environment
// and verifier. The owners of the given accounts are deleted when the test
// ends.
func newOwnerAPI(t *testing.T, verifier identity.TokenVerifier, uids ...string) ownerAPI {
	t.Helper()
	pool := postgrestest.Open(t)
	t.Cleanup(func() { deleteOwners(t, pool, uids) })
	operations := server{
		Handlers: identity.NewHandlers(identity.NewService(pool, time.Now)),
		logger:   slog.New(slog.DiscardHandler),
		database: pool,
	}
	return ownerAPI{t: t, handler: newHandler(slog.New(slog.DiscardHandler), operations, verifier)}
}

func deleteOwners(t *testing.T, pool *pgxpool.Pool, uids []string) {
	t.Helper()
	ctx := context.WithoutCancel(t.Context())
	if _, err := pool.Exec(ctx, "DELETE FROM owners WHERE firebase_uid = ANY($1)", uids); err != nil {
		t.Errorf("delete the owners of the test: %v", err)
	}
}

// call sends a request with the token and validates the response against
// the contract.
func (a ownerAPI) call(method, path, token, body string) *httptest.ResponseRecorder {
	a.t.Helper()
	var reader io.Reader
	if body != "" {
		reader = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, path, reader)
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	a.handler.ServeHTTP(rec, req)
	validateResponse(a.t, req, rec.Code, rec.Header(), rec.Body.Bytes())
	return rec
}

func decode[T any](t *testing.T, rec *httptest.ResponseRecorder) T {
	t.Helper()
	var value T
	if err := json.Unmarshal(rec.Body.Bytes(), &value); err != nil {
		t.Fatalf("decode body %q: %v", rec.Body.String(), err)
	}
	return value
}

const _registerBody = `{"name": "  Ana Lima ", "acceptedTermsVersion": "2026-11-10"}`

func TestRegisterMeThenGetMe(t *testing.T) {
	uid := "uid-" + rand.Text()
	verifier := fakeVerifier{identities: map[string]identity.Identity{
		"token-ana": {UID: uid, Email: "ana@example.com"},
	}}
	ownerAPI := newOwnerAPI(t, verifier, uid)

	// The account has no owner before the registration.
	before := ownerAPI.call(http.MethodGet, "/v1/me", "token-ana", "")
	if before.Code != http.StatusNotFound {
		t.Fatalf("GET /v1/me before the registration: status = %d, want 404", before.Code)
	}
	if code := decode[api.Error](t, before).Error; code != api.ErrorCodeOwnerNotFound {
		t.Errorf("error code = %q, want %q", code, api.ErrorCodeOwnerNotFound)
	}

	// RF-01, RN-01: the registration stores the name and the accepted terms.
	created := ownerAPI.call(http.MethodPost, "/v1/me", "token-ana", _registerBody)
	if created.Code != http.StatusCreated {
		t.Fatalf("POST /v1/me: status = %d, want 201, body %s", created.Code, created.Body)
	}
	owner := decode[api.Owner](t, created)
	if owner.Name != "Ana Lima" || owner.Email != "ana@example.com" ||
		owner.TermsVersion != api.TermsVersionN20261110 || owner.Id == "" {
		t.Errorf("owner = %+v, want name Ana Lima, the e-mail of the token and the current terms", owner)
	}
	if age := time.Since(owner.TermsAcceptedAt); age < 0 || age > time.Minute {
		t.Errorf("termsAcceptedAt = %v, want the time of the registration", owner.TermsAcceptedAt)
	}

	// A second registration changes nothing and returns the same owner.
	again := ownerAPI.call(http.MethodPost, "/v1/me", "token-ana",
		`{"name": "Other name", "acceptedTermsVersion": "2026-11-10"}`)
	if again.Code != http.StatusOK {
		t.Fatalf("second POST /v1/me: status = %d, want 200", again.Code)
	}
	if got := decode[api.Owner](t, again); got.Id != owner.Id || got.Name != "Ana Lima" {
		t.Errorf("second POST /v1/me: owner = %+v, want the first owner without changes", got)
	}

	after := ownerAPI.call(http.MethodGet, "/v1/me", "token-ana", "")
	if after.Code != http.StatusOK {
		t.Fatalf("GET /v1/me after the registration: status = %d, want 200", after.Code)
	}
	if got := decode[api.Owner](t, after); got.Id != owner.Id {
		t.Errorf("GET /v1/me: id = %q, want %q", got.Id, owner.Id)
	}
}

func TestRegisterMeRejectsAnInvalidRequest(t *testing.T) {
	uid := "uid-" + rand.Text()
	verifier := fakeVerifier{identities: map[string]identity.Identity{
		"token-ana": {UID: uid, Email: "ana@example.com"},
	}}
	ownerAPI := newOwnerAPI(t, verifier, uid)
	tests := []struct {
		name string
		body string
	}{
		{name: "body that is not JSON", body: `{"name": `},
		{name: "RN-45 empty name", body: `{"name": "", "acceptedTermsVersion": "2026-11-10"}`},
		{name: "RN-45 no name", body: `{"acceptedTermsVersion": "2026-11-10"}`},
		{name: "RN-01 old terms version", body: `{"name": "Ana", "acceptedTermsVersion": "2020-01-01"}`},
		{name: "RN-01 no terms version", body: `{"name": "Ana"}`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := ownerAPI.call(http.MethodPost, "/v1/me", "token-ana", tt.body)

			if rec.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400, body %s", rec.Code, rec.Body)
			}
			if code := decode[api.Error](t, rec).Error; code != api.ErrorCodeInvalidRequest {
				t.Errorf("error code = %q, want %q", code, api.ErrorCodeInvalidRequest)
			}
		})
	}

	// No request above created the owner.
	if rec := ownerAPI.call(http.MethodGet, "/v1/me", "token-ana", ""); rec.Code != http.StatusNotFound {
		t.Errorf("GET /v1/me after the invalid requests: status = %d, want 404", rec.Code)
	}
}

// emulatorAccount creates an account in the Authentication emulator and
// returns its identifier and an ID token.
func emulatorAccount(t *testing.T, email string) (uid, idToken string) {
	t.Helper()
	url := "http://" + emulatorHost(t) + "/identitytoolkit.googleapis.com/v1/accounts:signUp?key=test"
	payload, err := json.Marshal(map[string]any{
		"email":             email,
		"password":          rand.Text(),
		"returnSecureToken": true,
	})
	if err != nil {
		t.Fatalf("encode sign-up request: %v", err)
	}
	req, err := http.NewRequestWithContext(t.Context(), http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		t.Fatalf("build sign-up request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("sign up in the emulator: %v", err)
	}
	body, rerr := io.ReadAll(resp.Body)
	if cerr := resp.Body.Close(); cerr != nil {
		t.Fatalf("close sign-up response: %v", cerr)
	}
	if rerr != nil || resp.StatusCode != http.StatusOK {
		t.Fatalf("sign up in the emulator: status %d, read error %v, body %s", resp.StatusCode, rerr, body)
	}
	var account struct {
		LocalID string `json:"localId"`
		IDToken string `json:"idToken"`
	}
	if err := json.Unmarshal(body, &account); err != nil {
		t.Fatalf("decode sign-up response %s: %v", body, err)
	}
	return account.LocalID, account.IDToken
}

// The Firebase Admin SDK validates a token of the Authentication emulator,
// and the API registers the owner of that account.
func TestOwnerRegistrationWithATokenOfTheEmulator(t *testing.T) {
	email := fmt.Sprintf("tutor-%s@example.com", strings.ToLower(rand.Text()))
	uid, idToken := emulatorAccount(t, email)
	verifier, err := firebase.NewVerifier(t.Context(), _emulatorProjectID)
	if err != nil {
		t.Fatalf("NewVerifier: %v", err)
	}
	ownerAPI := newOwnerAPI(t, tokenVerifier{firebase: verifier}, uid)

	created := ownerAPI.call(http.MethodPost, "/v1/me", idToken, _registerBody)
	if created.Code != http.StatusCreated {
		t.Fatalf("POST /v1/me: status = %d, want 201, body %s", created.Code, created.Body)
	}
	if owner := decode[api.Owner](t, created); owner.Email != email {
		t.Errorf("owner e-mail = %q, want the e-mail of the account %q", owner.Email, email)
	}
	if rec := ownerAPI.call(http.MethodGet, "/v1/me", idToken, ""); rec.Code != http.StatusOK {
		t.Errorf("GET /v1/me: status = %d, want 200", rec.Code)
	}

	// RN-46: the real verifier rejects a text that is not a token.
	if rec := ownerAPI.call(http.MethodGet, "/v1/me", "not-a-token", ""); rec.Code != http.StatusUnauthorized {
		t.Errorf("GET /v1/me with an invalid token: status = %d, want 401", rec.Code)
	}
}
