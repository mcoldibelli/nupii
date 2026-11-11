//go:build integration

package main

import (
	"bytes"
	"crypto/rand"
	"fmt"
	"math"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/mcoldibelli/nupii/backend/internal/api"
	"github.com/mcoldibelli/nupii/backend/internal/platform/inference"
)

// gallery is in the place of the inference service: it gives each photo
// the vector that the test chose. Each test has its own model version, so
// the noseprints of other tests are not in its search.
type gallery struct {
	modelVersion string
	vectors      map[string][]float32
}

// newGallery makes the embedder of testAPI answer with the vectors of the
// gallery.
func newGallery(testAPI testAPI) *gallery {
	g := &gallery{modelVersion: "test-" + rand.Text(), vectors: make(map[string][]float32)}
	testAPI.embedder.embed = func(image []byte) (inference.Embedding, error) {
		vector, ok := g.vectors[string(image)]
		if !ok {
			// A photo of another test, which the recompute reads.
			return inference.Embedding{}, inference.ErrInvalidImage
		}
		return inference.Embedding{Vector: vector, ModelVersion: g.modelVersion, Quality: 0.9}, nil
	}
	return g
}

// photo returns a new photo whose vector has the cosine similarity with
// the photo of the search (queryPhoto). other is an index from 1 to 511,
// different for each photo, so two photos of the gallery are not similar.
func (g *gallery) photo(similarity float64, other int) []byte {
	vector := make([]float32, inference.Dimensions)
	vector[0] = float32(similarity)
	vector[other] = float32(math.Sqrt(1 - similarity*similarity))
	photo := nosePhoto()
	g.vectors[string(photo)] = vector
	return photo
}

// queryPhoto returns a new photo with the vector that the other photos are
// compared with.
func (g *gallery) queryPhoto() []byte {
	return g.photo(1, 1)
}

// public sends a multipart body with no token. Each call comes from a new
// address, so the rate limit of RN-43 does not count the calls together.
func (a testAPI) public(path string, fields map[string]string, file []byte) *httptest.ResponseRecorder {
	a.t.Helper()
	return a.publicFrom("198.51.100."+fmt.Sprint(1+randomByte()%250)+":"+fmt.Sprint(1024+int(randomByte())*200+int(randomByte())),
		path, fields, file)
}

func randomByte() byte {
	var b [1]byte
	if _, err := rand.Read(b[:]); err != nil {
		panic(err)
	}
	return b[0]
}

func (a testAPI) publicFrom(remoteAddr, path string, fields map[string]string, file []byte) *httptest.ResponseRecorder {
	a.t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	for name, value := range fields {
		if err := writer.WriteField(name, value); err != nil {
			a.t.Fatalf("write the field %s: %v", name, err)
		}
	}
	if file != nil {
		part, err := writer.CreateFormFile("file", "photo")
		if err != nil {
			a.t.Fatalf("create the multipart file: %v", err)
		}
		if _, err := part.Write(file); err != nil {
			a.t.Fatalf("write the multipart file: %v", err)
		}
	}
	if err := writer.Close(); err != nil {
		a.t.Fatalf("close the multipart body: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, path, &body)
	req.RemoteAddr = remoteAddr
	req.Header.Set("Content-Type", writer.FormDataContentType())
	rec := httptest.NewRecorder()
	a.handler.ServeHTTP(rec, req)
	validateResponse(a.t, req, rec.Code, rec.Header(), rec.Body.Bytes())
	return rec
}

// registerNose creates a dog of the owner of token with one noseprint for
// each similarity, and returns the pet.
func (a testAPI) dogWithNoses(g *gallery, token, name string, other int, similarities ...float64) api.Pet {
	a.t.Helper()
	pet := a.createPet(token, `{"name": "`+name+`", "species": "dog"}`)
	for i, similarity := range similarities {
		path := "/v1/pets/" + pet.Id.String() + "/noseprints"
		if rec := a.upload(http.MethodPost, token, path, g.photo(similarity, other+i)); rec.Code != http.StatusCreated {
			a.t.Fatalf("register the nose of %s: status = %d, body %s", name, rec.Code, rec.Body)
		}
	}
	return pet
}

func TestIdentification(t *testing.T) {
	testAPI := petsAPI(t)
	g := newGallery(testAPI)
	// RN-09: os cadastros anteriores continuam ativos. Rex has two
	// noseprints, and the older one is the most similar.
	rex := testAPI.dogWithNoses(g, "token-ana", "Rex", 10, 0.90, 0.80)
	testAPI.dogWithNoses(g, "token-ana", "Mel", 20, 0.60)
	testAPI.dogWithNoses(g, "token-bia", "Bob", 30, 0.50)
	testAPI.dogWithNoses(g, "token-bia", "Tom", 40, 0.45)
	testAPI.dogWithNoses(g, "token-bia", "Low", 50, 0.30)
	zed := testAPI.dogWithNoses(g, "token-bia", "Zed", 60, 0.95)
	if rec := testAPI.call(http.MethodDelete, "/v1/pets/"+zed.Id.String(), "token-bia", ""); rec.Code != http.StatusNoContent {
		t.Fatalf("delete Zed: status = %d", rec.Code)
	}
	petPhoto := []byte("\xFF\xD8\xFF\xE0profile photo")
	if rec := testAPI.uploadPhoto("token-ana", "/v1/pets/"+rex.Id.String()+"/photo", petPhoto); rec.Code != http.StatusOK {
		t.Fatalf("photo of Rex: status = %d", rec.Code)
	}

	// RF-12: the operation needs no account.
	rec := testAPI.public("/v1/identifications", nil, g.queryPhoto())
	if rec.Code != http.StatusOK {
		t.Fatalf("POST identifications: status = %d, want 200, body %s", rec.Code, rec.Body)
	}
	got := decode[api.Identification](t, rec)

	// RN-11: Zed is deleted. RN-12: Rex comes one time, with its most
	// similar photo. RN-13: Low is below 0.351. RN-14: Tom is the fourth.
	// RN-15: the gallery has 5 pets, so a strong match starts at 0.737.
	want := []struct {
		name       string
		similarity float64
		strong     bool
	}{
		{name: "Rex", similarity: 0.90, strong: true},
		{name: "Mel", similarity: 0.60},
		{name: "Bob", similarity: 0.50},
	}
	if len(got.Candidates) != len(want) {
		t.Fatalf("%d candidates, want %d: %s", len(got.Candidates), len(want), rec.Body)
	}
	for i, w := range want {
		c := got.Candidates[i]
		if c.PetName != w.name || math.Abs(c.Similarity-w.similarity) > 1e-4 || c.Strong != w.strong {
			t.Errorf("candidate %d = %s %.4f strong %t, want %s %.2f strong %t",
				i+1, c.PetName, c.Similarity, c.Strong, w.name, w.similarity, w.strong)
		}
	}
	if url := got.Candidates[0].PetPhotoUrl; url == nil {
		t.Error("the candidate Rex has no petPhotoUrl, and Rex has a profile photo")
	} else if status, body := readURL(t, *url); status != http.StatusOK || string(body) != string(petPhoto) {
		t.Errorf("read of petPhotoUrl: status %d, want 200 and the profile photo", status)
	}
	if got.Candidates[1].PetPhotoUrl != nil {
		t.Error("the candidate Mel has a petPhotoUrl, and Mel has no profile photo")
	}
	// RN-62: o resultado não tem dado do tutor.
	for _, ownerData := range []string{"Ana Lima", "ana@example.com", "bia@example.com", "owner"} {
		if strings.Contains(rec.Body.String(), ownerData) {
			t.Errorf("the body has %q, which is data of an owner: %s", ownerData, rec.Body)
		}
	}
	// RN-16: a foto da consulta só é gravada quando há confirmação.
	var photoKey *string
	const query = "SELECT photo_key FROM identifications WHERE id = $1"
	if err := testAPI.pool.QueryRow(t.Context(), query, got.Id.String()).Scan(&photoKey); err != nil {
		t.Fatalf("read the identification: %v", err)
	}
	if photoKey != nil {
		t.Errorf("the identification has the photo %q before a confirmation", *photoKey)
	}
}

func TestIdentificationWithNoCandidate(t *testing.T) {
	testAPI := petsAPI(t)
	g := newGallery(testAPI)
	testAPI.dogWithNoses(g, "token-ana", "Low", 10, 0.30)

	rec := testAPI.public("/v1/identifications", map[string]string{"latitude": "-23.55", "longitude": "-46.63"},
		g.queryPhoto())

	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"candidates":[]`) {
		t.Errorf("status = %d, body %s, want 200 with an empty list of candidates", rec.Code, rec.Body)
	}
}

func TestIdentificationRefusals(t *testing.T) {
	testAPI := petsAPI(t)
	g := newGallery(testAPI)
	tests := []struct {
		name       string
		fields     map[string]string
		file       []byte
		refusal    error
		wantStatus int
		wantCode   api.ErrorCode
	}{
		{name: "no file", wantStatus: http.StatusBadRequest, wantCode: api.ErrorCodeInvalidRequest},
		{name: "RN-59 file that is not an image", file: []byte("a text file"),
			wantStatus: http.StatusBadRequest, wantCode: api.ErrorCodeInvalidRequest},
		{name: "RN-61 latitude with no longitude", fields: map[string]string{"latitude": "-23.55"},
			file: g.queryPhoto(), wantStatus: http.StatusBadRequest, wantCode: api.ErrorCodeInvalidRequest},
		{name: "RN-61 latitude that is not a number", fields: map[string]string{"latitude": "south", "longitude": "1"},
			file: g.queryPhoto(), wantStatus: http.StatusBadRequest, wantCode: api.ErrorCodeInvalidRequest},
		{name: "RN-61 latitude out of the Earth", fields: map[string]string{"latitude": "90.5", "longitude": "1"},
			file: g.queryPhoto(), wantStatus: http.StatusBadRequest, wantCode: api.ErrorCodeInvalidRequest},
		{name: "RN-20 photo with no sharpness", file: nosePhoto(), refusal: inference.ErrLowQuality,
			wantStatus: http.StatusUnprocessableEntity, wantCode: api.ErrorCodeImageLowQuality},
		{name: "RN-21 photo with no nose", file: nosePhoto(), refusal: inference.ErrFraming,
			wantStatus: http.StatusUnprocessableEntity, wantCode: api.ErrorCodeImageFraming},
		{name: "inference service that does not respond", file: nosePhoto(), refusal: inference.ErrUnavailable,
			wantStatus: http.StatusServiceUnavailable, wantCode: api.ErrorCodeUnavailable},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.refusal != nil {
				testAPI.embedder.embed = func([]byte) (inference.Embedding, error) {
					return inference.Embedding{}, tt.refusal
				}
			}
			rec := testAPI.public("/v1/identifications", tt.fields, tt.file)
			if rec.Code != tt.wantStatus || decode[api.Error](t, rec).Error != tt.wantCode {
				t.Errorf("status = %d, body %s, want %d %s", rec.Code, rec.Body, tt.wantStatus, tt.wantCode)
			}
		})
	}
}

func (a testAPI) foundNotices(token string) []api.FoundNotice {
	a.t.Helper()
	rec := a.call(http.MethodGet, "/v1/found-notices", token, "")
	if rec.Code != http.StatusOK {
		a.t.Fatalf("GET found-notices: status = %d, body %s", rec.Code, rec.Body)
	}
	return decode[api.FoundNoticeList](a.t, rec).Notices
}

func TestConfirmationAndFoundNotices(t *testing.T) {
	testAPI := petsAPI(t)
	g := newGallery(testAPI)
	rex := testAPI.dogWithNoses(g, "token-ana", "Rex", 10, 0.90)
	testAPI.dogWithNoses(g, "token-bia", "Bob", 20, 0.50)

	query := g.queryPhoto()
	location := map[string]string{"latitude": "-23.5505", "longitude": "-46.6333"}
	found := decode[api.Identification](t, testAPI.public("/v1/identifications", location, query))
	if len(found.Candidates) != 2 {
		t.Fatalf("%d candidates, want Rex and Bob", len(found.Candidates))
	}
	confirmation := "/v1/identifications/" + found.Id.String() + "/confirmation"
	contact := map[string]string{
		"candidateId": found.Candidates[0].Id.String(),
		"name":        "  Caio Reis ",
		"phone":       "(11) 98888-7777",
		"message":     "Achei na praça.",
	}

	if got := testAPI.foundNotices("token-ana"); len(got) != 0 {
		t.Fatalf("%d found notices before a confirmation, want 0", len(got))
	}
	if rec := testAPI.public(confirmation, contact, query); rec.Code != http.StatusNoContent {
		t.Fatalf("POST confirmation: status = %d, want 204, body %s", rec.Code, rec.Body)
	}

	// RN-66: o aviso mostra o pet, o contato, a mensagem, o ponto e a data.
	notices := testAPI.foundNotices("token-ana")
	if len(notices) != 1 {
		t.Fatalf("%d found notices, want 1", len(notices))
	}
	first := notices[0]
	if first.PetId != rex.Id || first.PetName != "Rex" || first.ContactName != "Caio Reis" ||
		first.ContactPhone != "(11) 98888-7777" || first.Message == nil || *first.Message != "Achei na praça." {
		t.Errorf("found notice = %+v, want Rex with the contact of Caio", first)
	}
	if first.Latitude == nil || first.Longitude == nil ||
		math.Abs(*first.Latitude+23.5505) > 1e-6 || math.Abs(*first.Longitude+46.6333) > 1e-6 {
		t.Errorf("found notice has the point %v, %v, want -23.5505, -46.6333", first.Latitude, first.Longitude)
	}
	if first.ConfirmedAt.IsZero() {
		t.Error("found notice has no confirmedAt")
	}
	// The owner of another pet does not see the notice.
	if got := testAPI.foundNotices("token-bia"); len(got) != 0 {
		t.Errorf("Bia sees %d found notices, want 0: the confirmed pet is of Ana", len(got))
	}
	// RN-16: a foto da consulta é gravada na confirmação.
	photoKey := func() string {
		var key *string
		const read = "SELECT photo_key FROM identifications WHERE id = $1"
		if err := testAPI.pool.QueryRow(t.Context(), read, found.Id.String()).Scan(&key); err != nil {
			t.Fatalf("read the identification: %v", err)
		}
		if key == nil {
			return ""
		}
		return *key
	}
	firstKey := photoKey()
	if firstKey == "" {
		t.Error("the identification has no photo after the confirmation with a photo")
	}

	// RN-65: confirmar de novo muda só o contato.
	contact["name"], contact["phone"] = "Caio R.", "11 97777-6666"
	delete(contact, "message")
	if rec := testAPI.public(confirmation, contact, nosePhoto()); rec.Code != http.StatusNoContent {
		t.Fatalf("second confirmation: status = %d, want 204, body %s", rec.Code, rec.Body)
	}
	again := testAPI.foundNotices("token-ana")
	if len(again) != 1 || again[0].ContactName != "Caio R." || again[0].ContactPhone != "11 97777-6666" || again[0].Message != nil {
		t.Errorf("found notices after the second confirmation = %+v, want one notice with the new contact", again)
	}
	if len(again) == 1 && !again[0].ConfirmedAt.Equal(first.ConfirmedAt) {
		t.Errorf("confirmedAt changed from %v to %v", first.ConfirmedAt, again[0].ConfirmedAt)
	}
	if key := photoKey(); key != firstKey {
		t.Errorf("the photo changed from %q to %q", firstKey, key)
	}

	// The candidate of Bob is confirmed after: the notice of Bia is new,
	// and Ana still has one.
	contact["candidateId"] = found.Candidates[1].Id.String()
	if rec := testAPI.public(confirmation, contact, nil); rec.Code != http.StatusNoContent {
		t.Fatalf("confirmation of the second candidate: status = %d, body %s", rec.Code, rec.Body)
	}
	if got := testAPI.foundNotices("token-bia"); len(got) != 1 || got[0].PetName != "Bob" {
		t.Errorf("found notices of Bia = %+v, want one notice of Bob", got)
	}
}

func TestConfirmationRefusals(t *testing.T) {
	testAPI := petsAPI(t)
	g := newGallery(testAPI)
	testAPI.dogWithNoses(g, "token-ana", "Rex", 10, 0.90)
	identify := func() api.Identification {
		return decode[api.Identification](t, testAPI.public("/v1/identifications", nil, g.queryPhoto()))
	}
	found, other := identify(), identify()
	path := "/v1/identifications/" + found.Id.String() + "/confirmation"
	valid := func(change map[string]string) map[string]string {
		fields := map[string]string{
			"candidateId": found.Candidates[0].Id.String(), "name": "Caio", "phone": "11 98888-7777",
		}
		for name, value := range change {
			if value == "" {
				delete(fields, name)
				continue
			}
			fields[name] = value
		}
		return fields
	}
	const unknown = "0195f3c8-7a55-7c1e-9d2a-0d1c2b3a4f5e"

	tests := []struct {
		name       string
		path       string
		fields     map[string]string
		file       []byte
		wantStatus int
		wantCode   api.ErrorCode
	}{
		{name: "RN-64 candidate of another identification", path: path,
			fields:     valid(map[string]string{"candidateId": other.Candidates[0].Id.String()}),
			wantStatus: http.StatusNotFound, wantCode: api.ErrorCodeIdentificationNotFound},
		{name: "RN-64 identification that does not exist", path: "/v1/identifications/" + unknown + "/confirmation",
			fields: valid(nil), wantStatus: http.StatusNotFound, wantCode: api.ErrorCodeIdentificationNotFound},
		{name: "candidateId that is not an identifier", path: path, fields: valid(map[string]string{"candidateId": "rex"}),
			wantStatus: http.StatusBadRequest, wantCode: api.ErrorCodeInvalidRequest},
		{name: "RN-63 no name", path: path, fields: valid(map[string]string{"name": ""}),
			wantStatus: http.StatusBadRequest, wantCode: api.ErrorCodeInvalidRequest},
		{name: "RN-63 phone with letters", path: path, fields: valid(map[string]string{"phone": "my phone"}),
			wantStatus: http.StatusBadRequest, wantCode: api.ErrorCodeInvalidRequest},
		{name: "RN-63 message with 501 characters", path: path,
			fields:     valid(map[string]string{"message": strings.Repeat("a", 501)}),
			wantStatus: http.StatusBadRequest, wantCode: api.ErrorCodeInvalidRequest},
		{name: "RN-59 file that is not an image", path: path, fields: valid(nil), file: []byte("a text file"),
			wantStatus: http.StatusBadRequest, wantCode: api.ErrorCodeInvalidRequest},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := testAPI.public(tt.path, tt.fields, tt.file)
			if rec.Code != tt.wantStatus || decode[api.Error](t, rec).Error != tt.wantCode {
				t.Errorf("status = %d, body %s, want %d %s", rec.Code, rec.Body, tt.wantStatus, tt.wantCode)
			}
		})
	}
	if got := testAPI.foundNotices("token-ana"); len(got) != 0 {
		t.Errorf("%d found notices after the refusals, want 0", len(got))
	}
}

func TestFoundNoticesNeedARegisteredOwner(t *testing.T) {
	testAPI := petsAPI(t)

	rec := testAPI.call(http.MethodGet, "/v1/found-notices", "token-new", "")
	if rec.Code != http.StatusNotFound || decode[api.Error](t, rec).Error != api.ErrorCodeOwnerNotFound {
		t.Errorf("account with no owner: status = %d, body %s, want 404 owner_not_found", rec.Code, rec.Body)
	}
	rec = testAPI.call(http.MethodGet, "/v1/found-notices", "token-unknown", "")
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("token that is not valid: status = %d, want 401", rec.Code)
	}
}

// RN-43: um endpoint público aceita no máximo 10 POST por minuto, por IP e
// por caminho.
func TestPublicPostsHaveARateLimit(t *testing.T) {
	testAPI := petsAPI(t)
	g := newGallery(testAPI)
	query := g.queryPhoto()
	const address = "203.0.113.7:4000"

	for i := range 10 {
		if rec := testAPI.publicFrom(address, "/v1/identifications", nil, query); rec.Code != http.StatusOK {
			t.Fatalf("request %d: status = %d, want 200, body %s", i+1, rec.Code, rec.Body)
		}
	}
	rec := testAPI.publicFrom(address, "/v1/identifications", nil, query)
	if rec.Code != http.StatusTooManyRequests || decode[api.Error](t, rec).Error != api.ErrorCodeRateLimited {
		t.Errorf("request 11: status = %d, body %s, want 429 rate_limited", rec.Code, rec.Body)
	}
	if rec := testAPI.publicFrom("203.0.113.8:4000", "/v1/identifications", nil, query); rec.Code != http.StatusOK {
		t.Errorf("request of another address: status = %d, want 200", rec.Code)
	}
}
