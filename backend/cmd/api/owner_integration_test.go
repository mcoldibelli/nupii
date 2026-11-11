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
	"github.com/mcoldibelli/nupii/backend/internal/biometrics"
	"github.com/mcoldibelli/nupii/backend/internal/identity"
	"github.com/mcoldibelli/nupii/backend/internal/platform/firebase"
	"github.com/mcoldibelli/nupii/backend/internal/platform/inference"
	"github.com/mcoldibelli/nupii/backend/internal/platform/postgres/postgrestest"
	"github.com/mcoldibelli/nupii/backend/internal/platform/storage"
	"github.com/mcoldibelli/nupii/backend/internal/platform/storage/storagetest"
)

// testAPI is the handler of the API with the real database, for one test.
type testAPI struct {
	t       *testing.T
	handler http.Handler
	pool    *pgxpool.Pool
	// embedder is in the place of the inference service.
	embedder *fakeEmbedder
	// noseprints is the biometrics service of the server.
	noseprints *biometrics.Service
}

// fakeEmbedder is in the place of the inference service. A test sets embed
// to choose the answer for a photo.
type fakeEmbedder struct {
	embed        func(image []byte) (inference.Embedding, error)
	modelVersion func() (string, error)
}

func (f *fakeEmbedder) ModelVersion(context.Context) (string, error) {
	return f.modelVersion()
}

func (f *fakeEmbedder) Embed(_ context.Context, image []byte) (inference.Embedding, error) {
	return f.embed(image)
}

// unitVector returns a vector with the value 1 at index and 0 at the others.
func unitVector(index int) []float32 {
	vector := make([]float32, inference.Dimensions)
	vector[index] = 1
	return vector
}

// newTestAPI returns the API with the database of the local environment
// and verifier. The owners of the given accounts are deleted when the test
// ends.
func newTestAPI(t *testing.T, verifier identity.TokenVerifier, uids ...string) testAPI {
	t.Helper()
	pool := postgrestest.Open(t)
	t.Cleanup(func() { deleteOwners(t, pool, uids) })
	logger := slog.New(slog.DiscardHandler)
	photos := storage.New(storagetest.Config(t))
	embedder := &fakeEmbedder{
		embed: func([]byte) (inference.Embedding, error) {
			return inference.Embedding{Vector: unitVector(0), ModelVersion: "test-model", Quality: 0.9}, nil
		},
		modelVersion: func() (string, error) { return "test-model", nil },
	}
	operations := newServer(logger, pool, photos, embedder)
	return testAPI{
		t:          t,
		handler:    newHandler(logger, operations, verifier),
		pool:       pool,
		embedder:   embedder,
		noseprints: operations.noseprints,
	}
}

func deleteOwners(t *testing.T, pool *pgxpool.Pool, uids []string) {
	t.Helper()
	ctx := context.WithoutCancel(t.Context())
	const ownedPets = "SELECT p.id FROM pets AS p JOIN owners AS o ON o.id = p.owner_id WHERE o.firebase_uid = ANY($1)"
	const ownerIDs = "SELECT id FROM owners WHERE firebase_uid = ANY($1)"
	for _, table := range []string{"notifications", "owner_locations", "devices"} {
		if _, err := pool.Exec(ctx, "DELETE FROM "+table+" WHERE owner_id IN ("+ownerIDs+")", uids); err != nil {
			t.Errorf("delete the %s of the test: %v", table, err)
		}
	}
	if _, err := pool.Exec(ctx, "DELETE FROM health_events WHERE pet_id IN ("+ownedPets+")", uids); err != nil {
		t.Errorf("delete the health events of the test: %v", err)
	}
	const ownedReports = "SELECT id FROM reports WHERE pet_id IN (" + ownedPets + ")"
	if _, err := pool.Exec(ctx, "DELETE FROM sightings WHERE report_id IN ("+ownedReports+")", uids); err != nil {
		t.Errorf("delete the sightings of the test: %v", err)
	}
	if _, err := pool.Exec(ctx, "DELETE FROM reports WHERE pet_id IN ("+ownedPets+")", uids); err != nil {
		t.Errorf("delete the reports of the test: %v", err)
	}
	// The identifications stay: they have no owner. Their candidates point to the pets.
	if _, err := pool.Exec(ctx, "DELETE FROM identification_candidates WHERE pet_id IN ("+ownedPets+")", uids); err != nil {
		t.Errorf("delete the identification candidates of the test: %v", err)
	}
	if _, err := pool.Exec(ctx, "DELETE FROM noseprints WHERE pet_id IN ("+ownedPets+")", uids); err != nil {
		t.Errorf("delete the noseprints of the test: %v", err)
	}
	const deletePets = "DELETE FROM pets WHERE owner_id IN (SELECT id FROM owners WHERE firebase_uid = ANY($1))"
	if _, err := pool.Exec(ctx, deletePets, uids); err != nil {
		t.Errorf("delete the pets of the test: %v", err)
	}
	if _, err := pool.Exec(ctx, "DELETE FROM owners WHERE firebase_uid = ANY($1)", uids); err != nil {
		t.Errorf("delete the owners of the test: %v", err)
	}
}

// call sends a request with the token and validates the response against
// the contract.
func (a testAPI) call(method, path, token, body string) *httptest.ResponseRecorder {
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
	testAPI := newTestAPI(t, verifier, uid)

	// The account has no owner before the registration.
	before := testAPI.call(http.MethodGet, "/v1/me", "token-ana", "")
	if before.Code != http.StatusNotFound {
		t.Fatalf("GET /v1/me before the registration: status = %d, want 404", before.Code)
	}
	if code := decode[api.Error](t, before).Error; code != api.ErrorCodeOwnerNotFound {
		t.Errorf("error code = %q, want %q", code, api.ErrorCodeOwnerNotFound)
	}

	// RF-01, RN-01: o registro guarda o nome, a data e a versão dos termos aceitos.
	created := testAPI.call(http.MethodPost, "/v1/me", "token-ana", _registerBody)
	if created.Code != http.StatusCreated {
		t.Fatalf("POST /v1/me: status = %d, want 201, body %s", created.Code, created.Body)
	}
	owner := decode[api.Owner](t, created)
	if owner.Name != "Ana Lima" || owner.Email != "ana@example.com" ||
		owner.TermsVersion != identity.CurrentTermsVersion || owner.Id == "" {
		t.Errorf("owner = %+v, want name Ana Lima, the e-mail of the token and the current terms", owner)
	}
	if age := time.Since(owner.TermsAcceptedAt); age < 0 || age > time.Minute {
		t.Errorf("termsAcceptedAt = %v, want the time of the registration", owner.TermsAcceptedAt)
	}

	// A second registration changes nothing and returns the same owner.
	again := testAPI.call(http.MethodPost, "/v1/me", "token-ana",
		`{"name": "Other name", "acceptedTermsVersion": "2026-11-10"}`)
	if again.Code != http.StatusOK {
		t.Fatalf("second POST /v1/me: status = %d, want 200", again.Code)
	}
	if got := decode[api.Owner](t, again); got.Id != owner.Id || got.Name != "Ana Lima" {
		t.Errorf("second POST /v1/me: owner = %+v, want the first owner without changes", got)
	}

	after := testAPI.call(http.MethodGet, "/v1/me", "token-ana", "")
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
	testAPI := newTestAPI(t, verifier, uid)
	tests := []struct {
		name string
		body string
	}{
		{name: "body that is not JSON", body: `{"name": `},
		{name: "RN-45 empty name", body: `{"name": "", "acceptedTermsVersion": "2026-11-10"}`},
		{name: "RN-45 no name", body: `{"acceptedTermsVersion": "2026-11-10"}`},
		{name: "RN-01 version that is not the current one", body: `{"name": "Ana", "acceptedTermsVersion": "another-version"}`},
		{name: "RN-01 no terms version", body: `{"name": "Ana"}`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := testAPI.call(http.MethodPost, "/v1/me", "token-ana", tt.body)

			if rec.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400, body %s", rec.Code, rec.Body)
			}
			if code := decode[api.Error](t, rec).Error; code != api.ErrorCodeInvalidRequest {
				t.Errorf("error code = %q, want %q", code, api.ErrorCodeInvalidRequest)
			}
		})
	}

	// No request above created the owner.
	if rec := testAPI.call(http.MethodGet, "/v1/me", "token-ana", ""); rec.Code != http.StatusNotFound {
		t.Errorf("GET /v1/me after the invalid requests: status = %d, want 404", rec.Code)
	}
}

// emulatorSignUp asks the Authentication emulator to create an account.
// It returns the HTTP status and the body of the answer.
func emulatorSignUp(t *testing.T, email string) (status int, body []byte) {
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
	if rerr != nil {
		t.Fatalf("read sign-up response: %v", rerr)
	}
	return resp.StatusCode, body
}

// emulatorAccount creates an account in the Authentication emulator and
// returns its identifier and an ID token.
func emulatorAccount(t *testing.T, email string) (uid, idToken string) {
	t.Helper()
	status, body := emulatorSignUp(t, email)
	if status != http.StatusOK {
		t.Fatalf("sign up in the emulator: status %d, body %s", status, body)
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

// RN-02: um e-mail identifica uma conta só. O provedor de identidade aplica
// a regra: ele recusa uma segunda conta com o mesmo e-mail.
func TestIdentityProviderRejectsASecondAccountWithTheSameEmail(t *testing.T) {
	email := fmt.Sprintf("tutor-%s@example.com", strings.ToLower(rand.Text()))
	emulatorAccount(t, email)

	status, body := emulatorSignUp(t, email)

	if status != http.StatusBadRequest || !strings.Contains(string(body), "EMAIL_EXISTS") {
		t.Errorf("second sign-up with the same e-mail: status %d, body %s, want 400 with EMAIL_EXISTS", status, body)
	}
}

// The Firebase Admin SDK validates a token of the Authentication emulator,
// and the API registers the owner of that account.
//
// RN-47: a conta pode ser usada sem a confirmação do e-mail. A conta deste
// teste acabou de ser criada, e o e-mail dela não foi confirmado.
func TestOwnerRegistrationWithATokenOfTheEmulator(t *testing.T) {
	email := fmt.Sprintf("tutor-%s@example.com", strings.ToLower(rand.Text()))
	uid, idToken := emulatorAccount(t, email)
	verifier, err := firebase.NewVerifier(t.Context(), _emulatorProjectID)
	if err != nil {
		t.Fatalf("NewVerifier: %v", err)
	}
	testAPI := newTestAPI(t, tokenVerifier{firebase: verifier}, uid)

	created := testAPI.call(http.MethodPost, "/v1/me", idToken, _registerBody)
	if created.Code != http.StatusCreated {
		t.Fatalf("POST /v1/me: status = %d, want 201, body %s", created.Code, created.Body)
	}
	if owner := decode[api.Owner](t, created); owner.Email != email {
		t.Errorf("owner e-mail = %q, want the e-mail of the account %q", owner.Email, email)
	}
	if rec := testAPI.call(http.MethodGet, "/v1/me", idToken, ""); rec.Code != http.StatusOK {
		t.Errorf("GET /v1/me: status = %d, want 200", rec.Code)
	}

	// RN-46: o verificador real recusa um texto que não é um token.
	if rec := testAPI.call(http.MethodGet, "/v1/me", "not-a-token", ""); rec.Code != http.StatusUnauthorized {
		t.Errorf("GET /v1/me with an invalid token: status = %d, want 401", rec.Code)
	}
}
