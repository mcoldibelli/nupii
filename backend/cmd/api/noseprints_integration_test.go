//go:build integration

package main

import (
	"crypto/rand"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/mcoldibelli/nupii/backend/internal/api"
	"github.com/mcoldibelli/nupii/backend/internal/platform/inference"
)

// nosePhoto returns bytes that start as a JPEG file, different in each call.
func nosePhoto() []byte {
	return []byte("\xFF\xD8\xFF\xE0nose " + rand.Text())
}

// primaryCount returns the number of noseprints of the pet and how many of
// them are the primary one.
func (a testAPI) noseprintCounts(petID string) (total, primary int) {
	a.t.Helper()
	const query = "SELECT count(*), count(*) FILTER (WHERE is_primary) FROM noseprints WHERE pet_id = $1"
	if err := a.pool.QueryRow(a.t.Context(), query, petID).Scan(&total, &primary); err != nil {
		a.t.Fatalf("count the noseprints: %v", err)
	}
	return total, primary
}

func TestNoseprintLifecycle(t *testing.T) {
	testAPI := petsAPI(t)
	pet := testAPI.createPet("token-ana", `{"name": "Rex", "species": "dog"}`)
	base := "/v1/pets/" + pet.Id.String()

	rec := testAPI.call(http.MethodGet, base+"/noseprint", "token-ana", "")
	if rec.Code != http.StatusNotFound || decode[api.Error](t, rec).Error != api.ErrorCodeNoseprintNotFound {
		t.Fatalf("noseprint of a new pet: status = %d, body %s, want 404 noseprint_not_found",
			rec.Code, rec.Body)
	}

	photo := nosePhoto()
	rec = testAPI.upload(http.MethodPost, "token-ana", base+"/noseprints", photo)
	if rec.Code != http.StatusCreated {
		t.Fatalf("POST noseprints: status = %d, want 201, body %s", rec.Code, rec.Body)
	}
	// RN-86: a foto do focinho é gravada no cadastro e nunca volta numa resposta.
	noPhoto := func(what string, rec *httptest.ResponseRecorder) {
		t.Helper()
		if body := rec.Body.String(); strings.Contains(body, "imageUrl") || strings.Contains(body, "noseprints/") {
			t.Errorf("%s has the photo of the nose: %s", what, body)
		}
	}
	noPhoto("POST noseprints", rec)
	first := decode[api.Noseprint](t, rec)
	if first.Quality != 0.9 || first.ModelVersion != "test-model" || first.CapturedAt.IsZero() {
		t.Errorf("noseprint = %+v, want the quality and the model version of the inference service", first)
	}
	var key string
	const read = `SELECT image_key FROM noseprints WHERE id = $1`
	if err := testAPI.pool.QueryRow(t.Context(), read, first.Id).Scan(&key); err != nil {
		t.Fatalf("read the key of the photo: %v", err)
	}
	stored, err := testAPI.photos.SignedURL(key, time.Minute)
	if err != nil {
		t.Fatalf("sign the stored photo: %v", err)
	}
	if status, body := readURL(t, stored); status != http.StatusOK || string(body) != string(photo) {
		t.Errorf("stored photo: status %d and %d bytes, want 200 and the photo sent", status, len(body))
	}

	rec = testAPI.call(http.MethodGet, base+"/noseprint", "token-ana", "")
	noPhoto("GET noseprint", rec)
	got := decode[api.Noseprint](t, rec)
	if got.Id != first.Id {
		t.Errorf("GET noseprint gives %s, want the noseprint created %s", got.Id, first.Id)
	}

	// RN-09: o cadastro novo passa a ser o principal. Os anteriores continuam ativos.
	rec = testAPI.upload(http.MethodPost, "token-ana", base+"/noseprints", nosePhoto())
	if rec.Code != http.StatusCreated {
		t.Fatalf("second POST noseprints: status = %d, want 201, body %s", rec.Code, rec.Body)
	}
	second := decode[api.Noseprint](t, rec)
	// RN-60: o cadastro que a API devolve é o principal.
	got = decode[api.Noseprint](t, testAPI.call(http.MethodGet, base+"/noseprint", "token-ana", ""))
	if got.Id != second.Id || second.Id == first.Id {
		t.Errorf("GET noseprint gives %s, want the new noseprint %s", got.Id, second.Id)
	}
	if total, primary := testAPI.noseprintCounts(pet.Id.String()); total != 2 || primary != 1 {
		t.Errorf("the pet has %d noseprints and %d primary, want 2 and 1", total, primary)
	}

	// RN-52: o pet de outro tutor não existe para quem chama.
	for _, call := range []func() int{
		func() int {
			return testAPI.upload(http.MethodPost, "token-bia", base+"/noseprints", nosePhoto()).Code
		},
		func() int { return testAPI.call(http.MethodGet, base+"/noseprint", "token-bia", "").Code },
	} {
		if status := call(); status != http.StatusNotFound {
			t.Errorf("noseprint of the pet of another owner: status = %d, want 404", status)
		}
	}
}

func TestNoseprintRefusals(t *testing.T) {
	testAPI := petsAPI(t)
	dog := testAPI.createPet("token-ana", `{"name": "Rex", "species": "dog"}`)
	cat := testAPI.createPet("token-ana", `{"name": "Mia", "species": "cat"}`)
	path := func(pet api.Pet) string { return "/v1/pets/" + pet.Id.String() + "/noseprints" }

	tests := []struct {
		name       string
		pet        api.Pet
		photo      []byte
		refusal    error
		wantStatus int
		wantCode   api.ErrorCode
	}{
		{name: "RN-07 pet that is not a dog", pet: cat, photo: nosePhoto(),
			wantStatus: http.StatusUnprocessableEntity, wantCode: api.ErrorCodeSpeciesNotSupported},
		{name: "RN-59 file that is not an image", pet: dog, photo: []byte("a text file"),
			wantStatus: http.StatusBadRequest, wantCode: api.ErrorCodeInvalidRequest},
		{name: "RN-59 image with more than 8 MB", pet: dog, photo: append(nosePhoto(), make([]byte, 8<<20)...),
			wantStatus: http.StatusBadRequest, wantCode: api.ErrorCodeInvalidRequest},
		{name: "RN-20 photo with no sharpness", pet: dog, photo: nosePhoto(), refusal: inference.ErrLowQuality,
			wantStatus: http.StatusUnprocessableEntity, wantCode: api.ErrorCodeImageLowQuality},
		{name: "RN-21 photo with no nose", pet: dog, photo: nosePhoto(), refusal: inference.ErrFraming,
			wantStatus: http.StatusUnprocessableEntity, wantCode: api.ErrorCodeImageFraming},
		{name: "RN-17 image that the inference cannot read", pet: dog, photo: nosePhoto(), refusal: inference.ErrInvalidImage,
			wantStatus: http.StatusBadRequest, wantCode: api.ErrorCodeInvalidRequest},
		{name: "inference service that does not respond", pet: dog, photo: nosePhoto(), refusal: inference.ErrUnavailable,
			wantStatus: http.StatusServiceUnavailable, wantCode: api.ErrorCodeUnavailable},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			testAPI.embedder.embed = func([]byte) (inference.Embedding, error) {
				return inference.Embedding{}, tt.refusal
			}
			rec := testAPI.upload(http.MethodPost, "token-ana", path(tt.pet), tt.photo)
			if rec.Code != tt.wantStatus || decode[api.Error](t, rec).Error != tt.wantCode {
				t.Errorf("status = %d, body %s, want %d %s", rec.Code, rec.Body, tt.wantStatus, tt.wantCode)
			}
		})
	}
	// RN-08: uma foto recusada não é gravada.
	for _, pet := range []api.Pet{dog, cat} {
		if total, _ := testAPI.noseprintCounts(pet.Id.String()); total != 0 {
			t.Errorf("the pet %s has %d noseprints after the refusals, want 0", pet.Name, total)
		}
	}
}

// RN-09: with registrations at the same time, the pet has one primary noseprint.
func TestNoseprintRegistrationsAtTheSameTime(t *testing.T) {
	testAPI := petsAPI(t)
	pet := testAPI.createPet("token-ana", `{"name": "Rex", "species": "dog"}`)
	path := "/v1/pets/" + pet.Id.String() + "/noseprints"

	const registrations = 8
	var group sync.WaitGroup
	for i := range registrations {
		group.Go(func() {
			rec := testAPI.upload(http.MethodPost, "token-ana", path, nosePhoto())
			if rec.Code != http.StatusCreated {
				t.Errorf("registration %d: status = %d, want 201, body %s", i, rec.Code, rec.Body)
			}
		})
	}
	group.Wait()

	if total, primary := testAPI.noseprintCounts(pet.Id.String()); total != registrations || primary != 1 {
		t.Errorf("the pet has %d noseprints and %d primary, want %d and 1", total, primary, registrations)
	}
}

func TestNoseprintOfADeletedPet(t *testing.T) {
	testAPI := petsAPI(t)
	pet := testAPI.createPet("token-ana", `{"name": "Rex", "species": "dog"}`)
	base := "/v1/pets/" + pet.Id.String()
	if rec := testAPI.call(http.MethodDelete, base, "token-ana", ""); rec.Code != http.StatusNoContent {
		t.Fatalf("delete the pet: status = %d", rec.Code)
	}

	rec := testAPI.upload(http.MethodPost, "token-ana", base+"/noseprints", nosePhoto())
	if rec.Code != http.StatusNotFound || decode[api.Error](t, rec).Error != api.ErrorCodePetNotFound {
		t.Errorf("status = %d, body %s, want 404 pet_not_found", rec.Code, rec.Body)
	}
}

// The API with the real inference service of the local environment, and the
// generated images of the equality test of the service.
func TestNoseprintWithTheInferenceService(t *testing.T) {
	url := os.Getenv("INFERENCE_URL")
	if url == "" {
		t.Fatal("INFERENCE_URL is not set: the test needs the inference service of the compose")
	}
	testAPI := petsAPI(t)
	testAPI.embedder.embed = func(image []byte) (inference.Embedding, error) {
		return inference.New(url).Embed(t.Context(), image)
	}
	pet := testAPI.createPet("token-ana", `{"name": "Rex", "species": "dog"}`)
	path := "/v1/pets/" + pet.Id.String() + "/noseprints"
	image := func(name string) []byte {
		data, err := os.ReadFile("../../../inference/tests/data/synthetic/" + name)
		if err != nil {
			t.Fatalf("read the test image: %v", err)
		}
		return data
	}

	// The only generated image that the detector accepts.
	rec := testAPI.upload(http.MethodPost, "token-ana", path, image("11-texture-gray.png"))
	if rec.Code != http.StatusCreated {
		t.Fatalf("accepted image: status = %d, want 201, body %s", rec.Code, rec.Body)
	}
	var created api.Noseprint
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
		t.Fatalf("decode the noseprint: %v", err)
	}
	if created.ModelVersion != "tinyvit21m-s43" || created.Quality != 1 {
		t.Errorf("noseprint = %+v, want the model version tinyvit21m-s43 and the quality 1", created)
	}

	rec = testAPI.upload(http.MethodPost, "token-ana", path, image("04-flat-gray.png"))
	if rec.Code != http.StatusUnprocessableEntity || decode[api.Error](t, rec).Error != api.ErrorCodeImageLowQuality {
		t.Errorf("RN-20: status = %d, body %s, want 422 image_low_quality", rec.Code, rec.Body)
	}
	rec = testAPI.upload(http.MethodPost, "token-ana", path, image("01-noise.png"))
	if rec.Code != http.StatusUnprocessableEntity || decode[api.Error](t, rec).Error != api.ErrorCodeImageFraming {
		t.Errorf("RN-21: status = %d, body %s, want 422 image_framing", rec.Code, rec.Body)
	}
}

// RN-85: a conferência da foto do focinho usa a inferência e não grava nada.
func TestNoseprintCheck(t *testing.T) {
	testAPI := petsAPI(t)
	dog := testAPI.createPet("token-ana", `{"name": "Rex", "species": "dog"}`)
	path := "/v1/pets/" + dog.Id.String() + "/noseprints/check"

	rec := testAPI.upload(http.MethodPost, "token-ana", path, nosePhoto())
	if rec.Code != http.StatusOK {
		t.Fatalf("POST check: status = %d, want 200, body %s", rec.Code, rec.Body)
	}
	if check := decode[api.NoseprintCheck](t, rec); check.Quality != 0.9 {
		t.Errorf("check = %+v, want the quality of the inference service", check)
	}
	if total, _ := testAPI.noseprintCounts(dog.Id.String()); total != 0 {
		t.Errorf("%d noseprints after a check, want 0", total)
	}

	// The same refusals as the registration.
	testAPI.embedder.embed = func([]byte) (inference.Embedding, error) {
		return inference.Embedding{}, inference.ErrFraming
	}
	if rec := testAPI.upload(http.MethodPost, "token-ana", path, nosePhoto()); rec.Code != http.StatusUnprocessableEntity ||
		decode[api.Error](t, rec).Error != api.ErrorCodeImageFraming {
		t.Errorf("check of a photo with no nose: status = %d, want 422 image_framing", rec.Code)
	}
	cat := testAPI.createPet("token-ana", `{"name": "Mel", "species": "cat"}`)
	if rec := testAPI.upload(http.MethodPost, "token-ana", "/v1/pets/"+cat.Id.String()+"/noseprints/check", nosePhoto()); rec.Code != http.StatusUnprocessableEntity {
		t.Errorf("check for a cat: status = %d, want 422", rec.Code)
	}
	if rec := testAPI.upload(http.MethodPost, "token-bia", path, nosePhoto()); rec.Code != http.StatusNotFound {
		t.Errorf("check by Bia: status = %d, want 404 (RN-52)", rec.Code)
	}
}

// #252: the list of pets tells which pets have a noseprint, so the app does
// not ask GET /noseprint for each dog.
func TestPetListTellsWhichPetsHaveANoseprint(t *testing.T) {
	testAPI := petsAPI(t)
	withNose := testAPI.createPet("token-ana", `{"name": "Rex", "species": "dog"}`)
	testAPI.createPet("token-ana", `{"name": "Toby", "species": "dog"}`)
	rec := testAPI.upload(http.MethodPost, "token-ana", "/v1/pets/"+withNose.Id.String()+"/noseprints", nosePhoto())
	if rec.Code != http.StatusCreated {
		t.Fatalf("POST noseprints: status = %d, want 201, body %s", rec.Code, rec.Body)
	}

	list := decode[api.PetList](t, testAPI.call(http.MethodGet, "/v1/pets", "token-ana", ""))

	got := map[string]*bool{}
	for _, pet := range list.Pets {
		got[pet.Name] = pet.HasNoseprint
	}
	if got["Rex"] == nil || !*got["Rex"] || got["Toby"] == nil || *got["Toby"] {
		t.Errorf("hasNoseprint by pet = Rex %v, Toby %v, want true and false", got["Rex"], got["Toby"])
	}
}
