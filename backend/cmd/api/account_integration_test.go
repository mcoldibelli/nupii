//go:build integration

package main

import (
	"context"
	"log/slog"
	"net/http"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/mcoldibelli/nupii/backend/internal/api"
	"github.com/mcoldibelli/nupii/backend/internal/identity"
	"github.com/mcoldibelli/nupii/backend/internal/platform/inference"
	"github.com/mcoldibelli/nupii/backend/internal/platform/jobs"
)

// fakeUsers records the users that the job deletes in the identity provider.
type fakeUsers struct{ deleted []string }

func (u *fakeUsers) DeleteUser(_ context.Context, uid string) error {
	u.deleted = append(u.deleted, uid)
	return nil
}

// runIdentityJobs runs the due jobs of identity with users as the provider.
func (a testAPI) runIdentityJobs(users identity.UserDeleter) {
	a.t.Helper()
	runner := jobs.NewRunner(a.pool, slog.New(slog.DiscardHandler), a.accounts.JobHandlers(users))
	for {
		worked, err := runner.Work(a.t.Context())
		if err != nil {
			a.t.Fatalf("run the jobs: %v", err)
		}
		if !worked {
			return
		}
	}
}

func (a testAPI) count(query string, args ...any) int {
	a.t.Helper()
	var n int
	if err := a.pool.QueryRow(a.t.Context(), query, args...).Scan(&n); err != nil {
		a.t.Fatalf("count %q: %v", query, err)
	}
	return n
}

// RF-08: o tutor exclui a própria conta.
func TestAccountDeletion(t *testing.T) {
	testAPI := petsAPI(t)
	// A vector that only this test uses, so the identification finds Rex.
	testAPI.embedder.embed = func([]byte) (inference.Embedding, error) {
		return inference.Embedding{Vector: unitVector(511), ModelVersion: "test-model", Quality: 0.9}, nil
	}
	pet := testAPI.createPet("token-ana", `{"name": "Rex", "species": "dog", "vetName": "Dra. Lia"}`)
	petPath := "/v1/pets/" + pet.Id.String()
	withPhoto := decode[api.Pet](t, testAPI.uploadPhoto("token-ana", petPath+"/photo", []byte("\x89PNG\x0D\x0A\x1A\x0Arex")))
	if rec := testAPI.upload(http.MethodPost, "token-ana", petPath+"/noseprints", nosePhoto()); rec.Code != http.StatusCreated {
		t.Fatalf("POST noseprints: status = %d, body %s", rec.Code, rec.Body)
	}
	event := testAPI.createEvent("token-ana", pet, `{"type": "exam", "date": "`+dateText(0)+`", "name": "Hemograma"}`)
	attachmentPath := petPath + "/health-events/" + event.Id.String() + "/attachments"
	attachment := decode[api.HealthAttachment](t, testAPI.upload(http.MethodPost, "token-ana", attachmentPath, []byte("%PDF-1.7\nx")))
	link := decode[api.CreatedShareLink](t, testAPI.call(http.MethodPost, petPath+"/share-links", "token-ana", ""))
	testAPI.setLocation("token-ana", `{"latitude": -23.5505, "longitude": -46.6333}`)
	testAPI.call(http.MethodPut, "/v1/me/devices", "token-ana", `{"token": "device-of-ana", "platform": "android"}`)
	report := testAPI.reportLost("token-ana", pet, `"latitude": -23.5505, "longitude": -46.6333, "place": "Praça da Sé", "description": "Coleira azul"`)
	owner := decode[api.Owner](t, testAPI.call(http.MethodGet, "/v1/me", "token-ana", ""))
	var noseKey string
	if err := testAPI.pool.QueryRow(t.Context(), `SELECT image_key FROM noseprints WHERE pet_id = $1`, pet.Id).Scan(&noseKey); err != nil {
		t.Fatalf("read the noseprint: %v", err)
	}
	// A visitor found Rex: a confirmed candidate and the notification of Ana.
	identified := decode[api.Identification](t, testAPI.public("/v1/identifications", nil, nosePhoto()))
	if len(identified.Candidates) == 0 || identified.Candidates[0].PetName != "Rex" {
		t.Fatalf("candidates before the delete = %+v, want Rex first", identified.Candidates)
	}
	confirm := testAPI.public("/v1/identifications/"+identified.Id.String()+"/confirmation",
		map[string]string{"candidateId": identified.Candidates[0].Id.String(), "name": "Visitante", "phone": "11 99999-0000"},
		nosePhoto())
	if confirm.Code != http.StatusNoContent {
		t.Fatalf("confirm the candidate: status = %d, body %s", confirm.Code, confirm.Body)
	}
	testAPI.runJobs()
	if got := testAPI.count(`SELECT count(*) FROM notifications WHERE owner_id = $1`, owner.Id); got == 0 {
		t.Fatal("Ana has no notification before the delete")
	}
	bobPet := testAPI.createPet("token-bia", `{"name": "Bob", "species": "dog"}`)

	if rec := testAPI.call(http.MethodDelete, "/v1/me", "token-ana", ""); rec.Code != http.StatusNoContent {
		t.Fatalf("DELETE /v1/me: status = %d, body %s", rec.Code, rec.Body)
	}

	// RN-04: uma conta excluída recebe 401, mesmo com um token ainda válido,
	// também no registro.
	for _, call := range []struct{ method, path, body string }{
		{http.MethodGet, "/v1/me", ""},
		{http.MethodPost, "/v1/me", _registerBody},
		{http.MethodGet, "/v1/pets", ""},
		{http.MethodDelete, "/v1/me", ""},
	} {
		if rec := testAPI.call(call.method, call.path, "token-ana", call.body); rec.Code != http.StatusUnauthorized {
			t.Errorf("%s %s after the delete: status = %d, want 401", call.method, call.path, rec.Code)
		}
	}
	// Another account is not changed.
	if rec := testAPI.call(http.MethodGet, "/v1/pets/"+bobPet.Id.String(), "token-bia", ""); rec.Code != http.StatusOK {
		t.Errorf("GET the pet of Bia: status = %d, want 200", rec.Code)
	}

	// RN-03: o tutor fica anonimizado.
	var name, email string
	var deleted bool
	const anonymized = `SELECT name, email, deleted_at IS NOT NULL FROM owners WHERE id = $1`
	if err := testAPI.pool.QueryRow(t.Context(), anonymized, owner.Id).Scan(&name, &email, &deleted); err != nil {
		t.Fatalf("read the owner: %v", err)
	}
	if name != "Conta excluída" || email == "ana@example.com" || !deleted {
		t.Errorf("owner = %q %q deleted %v, want the anonymized owner", name, email, deleted)
	}

	// RN-84: o que a exclusão apaga.
	petID := pet.Id.String()
	for query, want := range map[string]int{
		`SELECT count(*) FROM pets WHERE id = $1 AND deleted_at IS NOT NULL AND photo_key IS NULL
			AND name = 'Pet excluído' AND vet_name IS NULL`: 1,
		`SELECT count(*) FROM noseprints WHERE pet_id = $1`:                0,
		`SELECT count(*) FROM identification_candidates WHERE pet_id = $1`: 0,
		`SELECT count(*) FROM health_events WHERE pet_id = $1`:             0,
		`SELECT count(*) FROM share_links WHERE pet_id = $1`:               0,
	} {
		if got := testAPI.count(query, petID); got != want {
			t.Errorf("%s: %d, want %d", query, got, want)
		}
	}
	for _, table := range []string{"owner_locations", "devices", "notifications"} {
		if got := testAPI.count("SELECT count(*) FROM "+table+" WHERE owner_id = $1", owner.Id); got != 0 {
			t.Errorf("%s of the deleted owner: %d, want 0", table, got)
		}
	}
	var status string
	var description, place *string
	const lost = `SELECT status, description, place FROM reports WHERE id = $1`
	if err := testAPI.pool.QueryRow(t.Context(), lost, report.Id).Scan(&status, &description, &place); err != nil {
		t.Fatalf("read the report: %v", err)
	}
	if status != "resolved" || description != nil || place != nil {
		t.Errorf("lost report = %s %v %v, want resolved with no description and no place", status, description, place)
	}
	// The objects leave the storage.
	noseURL, err := testAPI.photos.SignedURL(noseKey, time.Minute)
	if err != nil {
		t.Fatalf("sign the URL of the nose photo: %v", err)
	}
	for name, url := range map[string]string{"photo": *withPhoto.PhotoUrl, "attachment": attachment.Url, "nose photo": noseURL} {
		if status, _ := readURL(t, url); status != http.StatusNotFound {
			t.Errorf("read the %s after the delete: status %d, want 404", name, status)
		}
	}
	// RN-04: os pets saem do mural, e a carteirinha não abre.
	board := decode[api.ReportPage](t, testAPI.publicJSON(http.MethodGet, "/v1/reports", ""))
	for _, item := range board.Reports {
		if item.Id == report.Id {
			t.Error("the board has the report of the deleted account")
		}
	}
	if status, _ := testAPI.openCard(link.Token); status != http.StatusNotFound {
		t.Errorf("open the card of the deleted account: status = %d, want 404", status)
	}
	after := decode[api.Identification](t, testAPI.public("/v1/identifications", nil, nosePhoto()))
	for _, candidate := range after.Candidates {
		if candidate.PetName == "Rex" {
			t.Errorf("the identification after the delete has Rex: %+v", candidate)
		}
	}

	// A write that was in progress during the delete ends after the commit.
	// The job passes the erasers again (RN-84).
	const late = `INSERT INTO owner_locations (owner_id, location) VALUES ($1, 'POINT(-46.63 -23.55)')`
	if _, err := testAPI.pool.Exec(t.Context(), late, owner.Id); err != nil {
		t.Fatalf("insert the late location: %v", err)
	}
	const due = `UPDATE jobs SET run_at = now() WHERE kind = 'delete_identity_user' AND status = 'pending'`
	if _, err := testAPI.pool.Exec(t.Context(), due); err != nil {
		t.Fatalf("make the job due: %v", err)
	}

	// RN-03: a tarefa apaga o usuário no provedor de identidade.
	users := &fakeUsers{}
	testAPI.runIdentityJobs(users)
	var uid string
	if err := testAPI.pool.QueryRow(t.Context(), `SELECT firebase_uid FROM owners WHERE id = $1`, owner.Id).Scan(&uid); err != nil {
		t.Fatalf("read the uid: %v", err)
	}
	if !slices.Contains(users.deleted, uid) {
		t.Errorf("deleted users = %v, want %s", users.deleted, uid)
	}
	if got := testAPI.count(`SELECT count(*) FROM owner_locations WHERE owner_id = $1`, owner.Id); got != 0 {
		t.Errorf("late location after the job: %d, want 0", got)
	}
}

// RF-06: o tutor vê e altera o próprio nome.
func TestProfileName(t *testing.T) {
	testAPI := petsAPI(t)
	rec := testAPI.call(http.MethodPatch, "/v1/me", "token-ana", `{"name": "  Ana Souza  "}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("PATCH /v1/me: status = %d, body %s", rec.Code, rec.Body)
	}
	if owner := decode[api.Owner](t, rec); owner.Name != "Ana Souza" || owner.Email != "ana@example.com" {
		t.Errorf("owner = %+v, want the new name and the same e-mail", owner)
	}
	if owner := decode[api.Owner](t, testAPI.call(http.MethodGet, "/v1/me", "token-ana", "")); owner.Name != "Ana Souza" {
		t.Errorf("GET /v1/me: name = %q, want Ana Souza", owner.Name)
	}
	// RN-45: o nome do tutor é obrigatório e tem no máximo 100 caracteres.
	for _, name := range []string{" ", strings.Repeat("a", 101)} {
		if rec := testAPI.call(http.MethodPatch, "/v1/me", "token-ana", `{"name": "`+name+`"}`); rec.Code != http.StatusBadRequest {
			t.Errorf("PATCH /v1/me with %d characters: status = %d, want 400", len(name), rec.Code)
		}
	}
	if rec := testAPI.call(http.MethodPatch, "/v1/me", "token-new", `{"name": "X"}`); rec.Code != http.StatusNotFound {
		t.Errorf("PATCH /v1/me with no owner: status = %d, want 404", rec.Code)
	}
}
