//go:build integration

package main

import (
	"crypto/rand"
	"net/http"
	"testing"

	"github.com/mcoldibelli/nupii/backend/internal/api"
	"github.com/mcoldibelli/nupii/backend/internal/identity"
)

// petsAPI returns the API with two registered owners, with the tokens
// "token-ana" and "token-bia", and the account "token-new" without an owner.
func petsAPI(t *testing.T) testAPI {
	t.Helper()
	ana, bia, newcomer := "uid-"+rand.Text(), "uid-"+rand.Text(), "uid-"+rand.Text()
	verifier := fakeVerifier{identities: map[string]identity.Identity{
		"token-ana": {UID: ana, Email: "ana@example.com"},
		"token-bia": {UID: bia, Email: "bia@example.com"},
		"token-new": {UID: newcomer, Email: "new@example.com"},
	}}
	testAPI := newTestAPI(t, verifier, ana, bia, newcomer)
	for _, token := range []string{"token-ana", "token-bia"} {
		if rec := testAPI.call(http.MethodPost, "/v1/me", token, _registerBody); rec.Code != http.StatusCreated {
			t.Fatalf("register the owner of %s: status = %d, body %s", token, rec.Code, rec.Body)
		}
	}
	return testAPI
}

func (a testAPI) createPet(token, body string) api.Pet {
	a.t.Helper()
	rec := a.call(http.MethodPost, "/v1/pets", token, body)
	if rec.Code != http.StatusCreated {
		a.t.Fatalf("POST /v1/pets: status = %d, want 201, body %s", rec.Code, rec.Body)
	}
	return decode[api.Pet](a.t, rec)
}

func TestPetLifecycle(t *testing.T) {
	testAPI := petsAPI(t)

	// RF-09: o tutor cria um pet com todos os dados.
	rex := testAPI.createPet("token-ana", `{
		"name": "  rex ", "species": "dog", "breed": "Vira-lata", "sex": "male", "size": "medium",
		"birthDate": "2021-03-15", "weightKg": 12.35, "neutered": true,
		"vetName": "Dra. Bia", "vetClinic": "Clínica Central", "vetPhone": "11 99999-0000"
	}`)
	if rex.Name != "rex" || rex.Species != api.SpeciesDog || rex.Breed == nil || *rex.Breed != "Vira-lata" ||
		rex.WeightKg == nil || *rex.WeightKg != 12.35 || rex.BirthDate == nil ||
		rex.BirthDate.Format("2006-01-02") != "2021-03-15" || rex.Neutered == nil || !*rex.Neutered {
		t.Errorf("created pet = %+v, want the data of the request", rex)
	}
	testAPI.createPet("token-ana", `{"name": "Bela", "species": "cat"}`)
	testAPI.createPet("token-ana", `{"name": "amora", "species": "other"}`)

	// RN-53: a lista mostra os pets do tutor em ordem de nome.
	listed := decode[api.PetList](t, testAPI.call(http.MethodGet, "/v1/pets", "token-ana", ""))
	var names []string
	for _, pet := range listed.Pets {
		names = append(names, pet.Name)
	}
	if len(names) != 3 || names[0] != "amora" || names[1] != "Bela" || names[2] != "rex" {
		t.Errorf("names of the list = %q, want [amora Bela rex]", names)
	}

	path := "/v1/pets/" + rex.Id.String()
	if rec := testAPI.call(http.MethodGet, path, "token-ana", ""); rec.Code != http.StatusOK {
		t.Fatalf("GET %s: status = %d, want 200", path, rec.Code)
	}

	// The update replaces all the data: an optional value that is not in
	// the body becomes empty.
	rec := testAPI.call(http.MethodPut, path, "token-ana", `{"name": "Rex", "species": "dog", "weightKg": 13}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("PUT %s: status = %d, want 200, body %s", path, rec.Code, rec.Body)
	}
	updated := decode[api.Pet](t, rec)
	if updated.Name != "Rex" || updated.Breed != nil || updated.BirthDate != nil ||
		updated.WeightKg == nil || *updated.WeightKg != 13 {
		t.Errorf("updated pet = %+v, want name Rex, weight 13 and the other optional data empty", updated)
	}

	// RN-05: a exclusão é lógica. O registro fica no banco com a data da exclusão.
	if rec := testAPI.call(http.MethodDelete, path, "token-ana", ""); rec.Code != http.StatusNoContent {
		t.Fatalf("DELETE %s: status = %d, want 204", path, rec.Code)
	}
	var deletedRows int
	const countDeleted = "SELECT count(*) FROM pets WHERE id = $1 AND deleted_at IS NOT NULL"
	if err := testAPI.pool.QueryRow(t.Context(), countDeleted, rex.Id.String()).Scan(&deletedRows); err != nil {
		t.Fatalf("count the deleted row: %v", err)
	}
	if deletedRows != 1 {
		t.Errorf("rows of the deleted pet with deleted_at = %d, want 1", deletedRows)
	}
	after := decode[api.PetList](t, testAPI.call(http.MethodGet, "/v1/pets", "token-ana", ""))
	if len(after.Pets) != 2 {
		t.Errorf("the list has %d pets after the delete, want 2", len(after.Pets))
	}
	for _, method := range []string{http.MethodGet, http.MethodDelete} {
		rec := testAPI.call(method, path, "token-ana", "")
		if rec.Code != http.StatusNotFound || decode[api.Error](t, rec).Error != api.ErrorCodePetNotFound {
			t.Errorf("%s of a deleted pet: status = %d, body %s, want 404 pet_not_found", method, rec.Code, rec.Body)
		}
	}
}

// RN-52: só o tutor do pet vê, altera e exclui o pet. Para outro tutor, o
// pet não existe.
func TestPetOfAnotherOwnerDoesNotExist(t *testing.T) {
	testAPI := petsAPI(t)
	pet := testAPI.createPet("token-ana", `{"name": "Rex", "species": "dog"}`)
	path := "/v1/pets/" + pet.Id.String()
	tests := []struct {
		method string
		body   string
	}{
		{method: http.MethodGet},
		{method: http.MethodPut, body: `{"name": "Taken", "species": "cat"}`},
		{method: http.MethodDelete},
	}
	for _, tt := range tests {
		t.Run("RN-52 "+tt.method, func(t *testing.T) {
			rec := testAPI.call(tt.method, path, "token-bia", tt.body)
			if rec.Code != http.StatusNotFound || decode[api.Error](t, rec).Error != api.ErrorCodePetNotFound {
				t.Errorf("status = %d, body %s, want 404 pet_not_found", rec.Code, rec.Body)
			}
		})
	}

	if list := decode[api.PetList](t, testAPI.call(http.MethodGet, "/v1/pets", "token-bia", "")); len(list.Pets) != 0 {
		t.Errorf("the other owner sees %d pets, want 0", len(list.Pets))
	}
	got := decode[api.Pet](t, testAPI.call(http.MethodGet, path, "token-ana", ""))
	if got.Name != "Rex" || got.Species != api.SpeciesDog {
		t.Errorf("the pet changed after the requests of the other owner: %+v", got)
	}
}

func TestPetRequestsThatAreNotValid(t *testing.T) {
	testAPI := petsAPI(t)
	pet := testAPI.createPet("token-ana", `{"name": "Rex", "species": "dog"}`)
	tests := []struct {
		name   string
		method string
		path   string
		body   string
	}{
		{name: "RN-48 no name", method: http.MethodPost, path: "/v1/pets", body: `{"species": "dog"}`},
		{name: "RN-48 species that is not in the list", method: http.MethodPost, path: "/v1/pets", body: `{"name": "Rex", "species": "bird"}`},
		{name: "RN-50 birth date in the future", method: http.MethodPost, path: "/v1/pets", body: `{"name": "Rex", "species": "dog", "birthDate": "2999-01-01"}`},
		{name: "RN-51 weight with 3 decimal places", method: http.MethodPost, path: "/v1/pets", body: `{"name": "Rex", "species": "dog", "weightKg": 1.234}`},
		{name: "RN-51 weight in an update", method: http.MethodPut, path: "/v1/pets/" + pet.Id.String(), body: `{"name": "Rex", "species": "dog", "weightKg": 0}`},
		{name: "body that is not JSON", method: http.MethodPost, path: "/v1/pets", body: `{"name": `},
		{name: "birth date that is not a date", method: http.MethodPost, path: "/v1/pets", body: `{"name": "Rex", "species": "dog", "birthDate": "yesterday"}`},
		{name: "identifier that is not a UUID", method: http.MethodGet, path: "/v1/pets/not-a-uuid"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := testAPI.call(tt.method, tt.path, "token-ana", tt.body)
			if rec.Code != http.StatusBadRequest || decode[api.Error](t, rec).Error != api.ErrorCodeInvalidRequest {
				t.Errorf("status = %d, body %s, want 400 invalid_request", rec.Code, rec.Body)
			}
		})
	}
}

func TestPetsNeedARegisteredOwner(t *testing.T) {
	testAPI := petsAPI(t)
	tests := []struct {
		method string
		path   string
		body   string
	}{
		{method: http.MethodGet, path: "/v1/pets"},
		{method: http.MethodPost, path: "/v1/pets", body: `{"name": "Rex", "species": "dog"}`},
		{method: http.MethodGet, path: "/v1/pets/0195f3c8-7a55-7c1e-9d2a-0d1c2b3a4f5e"},
	}
	for _, tt := range tests {
		t.Run(tt.method+" "+tt.path, func(t *testing.T) {
			rec := testAPI.call(tt.method, tt.path, "token-new", tt.body)
			if rec.Code != http.StatusNotFound || decode[api.Error](t, rec).Error != api.ErrorCodeOwnerNotFound {
				t.Errorf("status = %d, body %s, want 404 owner_not_found", rec.Code, rec.Body)
			}
		})
	}
}
