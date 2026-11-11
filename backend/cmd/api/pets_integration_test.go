//go:build integration

package main

import (
	"bytes"
	"crypto/rand"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
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

// uploadPhoto sends content as the part "file" of a multipart body and
// validates the response against the contract.
func (a testAPI) uploadPhoto(token, path string, content []byte) *httptest.ResponseRecorder {
	a.t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", "photo")
	if err != nil {
		a.t.Fatalf("create the multipart file: %v", err)
	}
	if _, err := part.Write(content); err != nil {
		a.t.Fatalf("write the multipart file: %v", err)
	}
	if err := writer.Close(); err != nil {
		a.t.Fatalf("close the multipart body: %v", err)
	}
	req := httptest.NewRequest(http.MethodPut, path, &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	a.handler.ServeHTTP(rec, req)
	validateResponse(a.t, req, rec.Code, rec.Header(), rec.Body.Bytes())
	return rec
}

// readURL reads url with no credential and returns the status and the body.
func readURL(t *testing.T, url string) (int, []byte) {
	t.Helper()
	req, err := http.NewRequestWithContext(t.Context(), http.MethodGet, url, nil)
	if err != nil {
		t.Fatalf("build request: %v", err)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("read %s: %v", url, err)
	}
	body, rerr := io.ReadAll(resp.Body)
	if cerr := resp.Body.Close(); cerr != nil {
		t.Fatalf("close answer: %v", cerr)
	}
	if rerr != nil {
		t.Fatalf("read answer: %v", rerr)
	}
	return resp.StatusCode, body
}

func TestPetPhoto(t *testing.T) {
	testAPI := petsAPI(t)
	pet := testAPI.createPet("token-ana", `{"name": "Rex", "species": "dog"}`)
	if pet.PhotoUrl != nil {
		t.Errorf("a new pet has photoUrl %q, want no photo", *pet.PhotoUrl)
	}
	path := "/v1/pets/" + pet.Id.String()
	first := []byte("\xFF\xD8\xFF\xE0first photo " + rand.Text())
	second := []byte("\x89PNG\x0D\x0A\x1A\x0Asecond photo " + rand.Text())

	// RF-10, RN-06: o tutor envia a foto, e a API devolve uma URL temporária.
	rec := testAPI.uploadPhoto("token-ana", path+"/photo", first)
	if rec.Code != http.StatusOK {
		t.Fatalf("PUT %s/photo: status = %d, want 200, body %s", path, rec.Code, rec.Body)
	}
	withPhoto := decode[api.Pet](t, rec)
	if withPhoto.PhotoUrl == nil {
		t.Fatal("the pet has no photoUrl after the upload")
	}
	firstURL := *withPhoto.PhotoUrl
	if !strings.Contains(firstURL, "X-Amz-Expires=900") {
		t.Errorf("photoUrl = %q, want a validity of 900 seconds (RN-06)", firstURL)
	}
	if status, body := readURL(t, firstURL); status != http.StatusOK || !bytes.Equal(body, first) {
		t.Errorf("read of photoUrl: status %d and %d bytes, want 200 and the %d bytes sent", status, len(body), len(first))
	}

	// The pet of the list and of the read has the photo too.
	listed := decode[api.PetList](t, testAPI.call(http.MethodGet, "/v1/pets", "token-ana", ""))
	if len(listed.Pets) != 1 || listed.Pets[0].PhotoUrl == nil {
		t.Errorf("the pet of the list has no photoUrl: %+v", listed.Pets)
	}

	// RN-55: uma foto nova substitui a anterior, e a anterior é apagada.
	rec = testAPI.uploadPhoto("token-ana", path+"/photo", second)
	if rec.Code != http.StatusOK {
		t.Fatalf("second PUT %s/photo: status = %d, want 200, body %s", path, rec.Code, rec.Body)
	}
	secondURL := *decode[api.Pet](t, rec).PhotoUrl
	if status, body := readURL(t, secondURL); status != http.StatusOK || !bytes.Equal(body, second) {
		t.Errorf("read of the new photoUrl: status %d and %d bytes, want 200 and the new photo", status, len(body))
	}
	if status, _ := readURL(t, firstURL); status != http.StatusNotFound {
		t.Errorf("read of the photo that was replaced: status %d, want 404", status)
	}

	// RN-52: outro tutor não envia foto para este pet.
	if rec := testAPI.uploadPhoto("token-bia", path+"/photo", first); rec.Code != http.StatusNotFound {
		t.Errorf("upload by another owner: status = %d, want 404", rec.Code)
	}

	// RN-05: a exclusão do pet apaga a foto de perfil do armazenamento.
	if rec := testAPI.call(http.MethodDelete, path, "token-ana", ""); rec.Code != http.StatusNoContent {
		t.Fatalf("DELETE %s: status = %d, want 204", path, rec.Code)
	}
	if status, _ := readURL(t, secondURL); status != http.StatusNotFound {
		t.Errorf("read of the photo of a deleted pet: status %d, want 404", status)
	}
}

// RN-54: a foto de perfil é uma imagem JPEG, PNG ou WebP, com no máximo 5 MB.
// A photo larger than the limit of a JSON body and smaller than the limit of
// RN-54 passes through all the middleware.
func TestPetPhotoOfTwoMebibytes(t *testing.T) {
	testAPI := petsAPI(t)
	pet := testAPI.createPet("token-ana", `{"name": "Rex", "species": "dog"}`)
	photo := make([]byte, 2<<20)
	copy(photo, "\xFF\xD8\xFF\xE0")

	rec := testAPI.uploadPhoto("token-ana", "/v1/pets/"+pet.Id.String()+"/photo", photo)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200, body %s", rec.Code, rec.Body)
	}
	got := decode[api.Pet](t, rec)
	if got.PhotoUrl == nil {
		t.Fatal("the pet has no photoUrl after the upload")
	}
	if status, body := readURL(t, *got.PhotoUrl); status != http.StatusOK || len(body) != len(photo) {
		t.Errorf("read of photoUrl: status %d and %d bytes, want 200 and %d bytes",
			status, len(body), len(photo))
	}
}

// RN-55: with uploads at the same time, only the photo that the pet keeps
// stays in the store.
func TestPetPhotoUploadsAtTheSameTime(t *testing.T) {
	testAPI := petsAPI(t)
	pet := testAPI.createPet("token-ana", `{"name": "Rex", "species": "dog"}`)
	path := "/v1/pets/" + pet.Id.String()

	const uploads = 8
	urls := make([]string, uploads)
	var group sync.WaitGroup
	for i := range uploads {
		group.Go(func() {
			photo := []byte("\xFF\xD8\xFF\xE0photo " + rand.Text())
			rec := testAPI.uploadPhoto("token-ana", path+"/photo", photo)
			if rec.Code != http.StatusOK {
				t.Errorf("upload %d: status = %d, want 200, body %s", i, rec.Code, rec.Body)
				return
			}
			var got api.Pet
			if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil || got.PhotoUrl == nil {
				t.Errorf("upload %d: body %s, want a pet with photoUrl (%v)", i, rec.Body, err)
				return
			}
			urls[i] = *got.PhotoUrl
		})
	}
	group.Wait()
	if t.Failed() {
		return
	}

	stored := 0
	for _, url := range urls {
		if status, _ := readURL(t, url); status == http.StatusOK {
			stored++
		}
	}
	if stored != 1 {
		t.Errorf("%d of the %d photos are in the store, want only the photo of the pet", stored, uploads)
	}
	got := decode[api.Pet](t, testAPI.call(http.MethodGet, path, "token-ana", ""))
	if got.PhotoUrl == nil {
		t.Fatal("the pet has no photoUrl after the uploads")
	}
	if status, _ := readURL(t, *got.PhotoUrl); status != http.StatusOK {
		t.Errorf("read of the photoUrl of the pet: status %d, want 200", status)
	}
}

func TestPetPhotoThatIsNotValid(t *testing.T) {
	testAPI := petsAPI(t)
	pet := testAPI.createPet("token-ana", `{"name": "Rex", "species": "dog"}`)
	path := "/v1/pets/" + pet.Id.String() + "/photo"
	tooBig := make([]byte, 5<<20+1)
	copy(tooBig, "\xFF\xD8\xFF\xE0")
	tests := []struct {
		name    string
		content []byte
	}{
		{name: "RN-54 file that is not an image", content: []byte("this is a text file")},
		{name: "RN-54 image with more than 5 MB", content: tooBig},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := testAPI.uploadPhoto("token-ana", path, tt.content)
			if rec.Code != http.StatusBadRequest || decode[api.Error](t, rec).Error != api.ErrorCodeInvalidRequest {
				t.Errorf("status = %d, body %s, want 400 invalid_request", rec.Code, rec.Body)
			}
		})
	}

	t.Run("body without the part file", func(t *testing.T) {
		rec := testAPI.call(http.MethodPut, path, "token-ana", `{"file": "x"}`)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("status = %d, body %s, want 400", rec.Code, rec.Body)
		}
	})

	got := decode[api.Pet](t, testAPI.call(http.MethodGet, "/v1/pets/"+pet.Id.String(), "token-ana", ""))
	if got.PhotoUrl != nil {
		t.Errorf("the pet has photoUrl %q after the invalid uploads, want no photo", *got.PhotoUrl)
	}
}
