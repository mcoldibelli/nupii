//go:build integration

package main

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/mcoldibelli/nupii/backend/internal/api"
)

func (a testAPI) openCard(token string) (int, []byte) {
	a.t.Helper()
	rec := a.publicJSON(http.MethodPost, "/v1/share-links/opening", `{"token": "`+token+`"}`)
	return rec.Code, rec.Body.Bytes()
}

// RF-30, RF-31: o tutor cria o link, qualquer pessoa com o link vê a
// carteirinha, e o link revogado devolve 404.
func TestShareLinkLifecycle(t *testing.T) {
	testAPI := petsAPI(t)
	pet := testAPI.createPet("token-ana", `{"name": "Rex", "species": "dog", "breed": "Vira-lata",
		"vetName": "Dra. Lia", "vetPhone": "11 3333-0000"}`)
	testAPI.uploadPhoto("token-ana", "/v1/pets/"+pet.Id.String()+"/photo", []byte("\x89PNG\x0D\x0A\x1A\x0Arex"))
	testAPI.createEvent("token-ana", pet, `{"type": "vaccine", "date": "`+dateText(-30)+`", "name": "V10", "batch": "L1", "nextDoseDate": "`+dateText(335)+`"}`)
	testAPI.createEvent("token-ana", pet, `{"type": "vaccine", "date": "`+dateText(-3)+`", "name": "Raiva"}`)
	testAPI.createEvent("token-ana", pet, `{"type": "medication", "date": "`+dateText(-10)+`", "name": "Bravecto", "medicationCategory": "flea", "intervalDays": 90}`)
	testAPI.createEvent("token-ana", pet, `{"type": "medication", "date": "`+dateText(-40)+`", "name": "Drontal", "medicationCategory": "deworm"}`)
	testAPI.createEvent("token-ana", pet, `{"type": "medication", "date": "`+dateText(-1)+`", "name": "Antibiótico", "medicationCategory": "medication"}`)
	testAPI.createEvent("token-ana", pet, `{"type": "exam", "date": "`+dateText(0)+`", "name": "Hemograma"}`)
	path := "/v1/pets/" + pet.Id.String() + "/share-links"

	rec := testAPI.call(http.MethodPost, path, "token-ana", "")
	if rec.Code != http.StatusCreated {
		t.Fatalf("POST share-links: status = %d, body %s", rec.Code, rec.Body)
	}
	link := decode[api.CreatedShareLink](t, rec)

	// RN-39: o token tem 256 bits, e só o SHA-256 dele vai para o banco.
	raw, err := base64.RawURLEncoding.DecodeString(link.Token)
	if err != nil || len(raw) != 32 {
		t.Errorf("token %q: %d bytes (%v), want 32 bytes in base64url", link.Token, len(raw), err)
	}
	var stored []byte
	const hash = `SELECT token_hash FROM share_links WHERE id = $1`
	if err := testAPI.pool.QueryRow(t.Context(), hash, link.Id).Scan(&stored); err != nil {
		t.Fatalf("read the hash: %v", err)
	}
	if sum := sha256.Sum256([]byte(link.Token)); string(stored) != string(sum[:]) {
		t.Errorf("token_hash is not the SHA-256 of the token")
	}

	// RN-40: o link vale 30 dias.
	if want := time.Now().Add(30 * 24 * time.Hour); link.ExpiresAt.Sub(want).Abs() > time.Minute {
		t.Errorf("expiresAt = %s, want 30 days from now", link.ExpiresAt)
	}

	// RF-31, RN-83: a carteirinha, sem conta.
	status, body := testAPI.openCard(link.Token)
	if status != http.StatusOK {
		t.Fatalf("open the card: status = %d, body %s", status, body)
	}
	var card api.HealthCard
	if err := json.Unmarshal(body, &card); err != nil {
		t.Fatalf("decode the card: %v", err)
	}
	if card.Pet.Name != "Rex" || card.Pet.Breed == nil || *card.Pet.Breed != "Vira-lata" ||
		card.Pet.VetName == nil || *card.Pet.VetName != "Dra. Lia" || card.Pet.PhotoUrl == nil ||
		!strings.Contains(*card.Pet.PhotoUrl, "X-Amz-Expires=900") {
		t.Errorf("pet of the card = %+v, want Rex with the vet and the photo (RN-06)", card.Pet)
	}
	if len(card.Vaccines) != 2 || card.Vaccines[0].Name != "Raiva" || card.Vaccines[1].Batch == nil ||
		*card.Vaccines[1].Batch != "L1" {
		t.Errorf("vaccines = %+v, want Raiva and V10, the newest first", card.Vaccines)
	}
	if len(card.ParasiteControl) != 2 || card.ParasiteControl[0].Name != "Bravecto" ||
		card.ParasiteControl[0].Category != api.HealthCardMedicationCategoryFlea ||
		card.ParasiteControl[1].Name != "Drontal" {
		t.Errorf("parasite control = %+v, want Bravecto and Drontal, the newest first", card.ParasiteControl)
	}
	// RN-83: sem dados do tutor, sem IDs internos e sem anexos. The key of
	// the photo in its temporary URL has the ID of the pet.
	withoutPhoto := regexp.MustCompile(`"photoUrl":"[^"]*"`).ReplaceAllString(string(body), "")
	for _, absent := range []string{pet.Id.String(), "ana@example.com", `"id"`, "attachment", "Hemograma"} {
		if strings.Contains(withoutPhoto, absent) {
			t.Errorf("the card has %q: %s", absent, body)
		}
	}

	// RN-40: o tutor vê os links ativos com as aberturas, do mais novo para
	// o mais antigo.
	testAPI.openCard(link.Token)
	newer := decode[api.CreatedShareLink](t, testAPI.call(http.MethodPost, path, "token-ana", ""))
	list := decode[api.ShareLinkList](t, testAPI.call(http.MethodGet, path, "token-ana", ""))
	if len(list.Links) != 2 || list.Links[0].Id != newer.Id || list.Links[1].Id != link.Id ||
		list.Links[1].Opens != 2 {
		t.Fatalf("links = %+v, want the new link, then the link with 2 opens", list.Links)
	}
	if strings.Contains(testAPI.call(http.MethodGet, path, "token-ana", "").Body.String(), link.Token) {
		t.Error("the list has the token (RN-39)")
	}

	// RN-52: para outro tutor, o pet não existe.
	if rec := testAPI.call(http.MethodGet, path, "token-bia", ""); rec.Code != http.StatusNotFound {
		t.Errorf("GET share-links by Bia: status = %d, want 404", rec.Code)
	}
	if rec := testAPI.call(http.MethodDelete, path+"/"+link.Id.String(), "token-bia", ""); rec.Code != http.StatusNotFound {
		t.Errorf("DELETE share link by Bia: status = %d, want 404", rec.Code)
	}

	// RN-41: um link revogado devolve 404, e sai da lista.
	if rec := testAPI.call(http.MethodDelete, path+"/"+link.Id.String(), "token-ana", ""); rec.Code != http.StatusNoContent {
		t.Fatalf("DELETE share link: status = %d, body %s", rec.Code, rec.Body)
	}
	if status, body := testAPI.openCard(link.Token); status != http.StatusNotFound ||
		!strings.Contains(string(body), string(api.ErrorCodeShareLinkNotFound)) {
		t.Errorf("open a revoked link: status = %d, body %s, want 404 share_link_not_found", status, body)
	}
	list = decode[api.ShareLinkList](t, testAPI.call(http.MethodGet, path, "token-ana", ""))
	if len(list.Links) != 1 || list.Links[0].Id != newer.Id {
		t.Errorf("links = %+v, want only the new link after the revoke", list.Links)
	}
	if rec := testAPI.call(http.MethodDelete, path+"/"+link.Id.String(), "token-ana", ""); rec.Code != http.StatusNoContent {
		t.Errorf("DELETE a revoked link: status = %d, want 204", rec.Code)
	}
}

// RN-40, RN-83: o tutor escolhe a validade do link (1, 7 ou 30 dias) e se a
// carteirinha mostra os exames.
func TestShareLinkOptions(t *testing.T) {
	testAPI := petsAPI(t)
	pet := testAPI.createPet("token-ana", `{"name": "Rex", "species": "dog"}`)
	testAPI.createEvent("token-ana", pet, `{"type": "exam", "date": "`+dateText(-2)+`", "name": "Hemograma", "lab": "Lab Vida", "result": "Normal"}`)
	path := "/v1/pets/" + pet.Id.String() + "/share-links"

	rec := testAPI.call(http.MethodPost, path, "token-ana", `{"validDays": 1, "includeExams": true}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("POST share-links with options: status = %d, body %s", rec.Code, rec.Body)
	}
	link := decode[api.CreatedShareLink](t, rec)
	if want := time.Now().Add(24 * time.Hour); link.ExpiresAt.Sub(want).Abs() > time.Minute {
		t.Errorf("expiresAt = %s, want 1 day from now", link.ExpiresAt)
	}
	if !link.IncludeExams {
		t.Error("includeExams = false, want true")
	}
	status, body := testAPI.openCard(link.Token)
	var card api.HealthCard
	if err := json.Unmarshal(body, &card); status != http.StatusOK || err != nil {
		t.Fatalf("open the card: status = %d, body %s (%v)", status, body, err)
	}
	if card.Exams == nil || len(*card.Exams) != 1 || (*card.Exams)[0].Name != "Hemograma" ||
		(*card.Exams)[0].Result == nil || *(*card.Exams)[0].Result != "Normal" {
		t.Errorf("exams = %+v, want Hemograma with its result", card.Exams)
	}

	// A link without options shows no exams.
	plain := decode[api.CreatedShareLink](t, testAPI.call(http.MethodPost, path, "token-ana", ""))
	if _, body := testAPI.openCard(plain.Token); strings.Contains(string(body), "Hemograma") {
		t.Errorf("the card of a link without exams has the exam: %s", body)
	}

	// Another validity is refused.
	if rec := testAPI.call(http.MethodPost, path, "token-ana", `{"validDays": 3}`); rec.Code != http.StatusBadRequest {
		t.Errorf("POST share-links with validDays 3: status = %d, want 400", rec.Code)
	}
}

// RN-41: um link desconhecido, vencido ou de um pet excluído devolve 404.
func TestShareLinkNotFound(t *testing.T) {
	testAPI := petsAPI(t)
	create := func(pet api.Pet) api.CreatedShareLink {
		rec := testAPI.call(http.MethodPost, "/v1/pets/"+pet.Id.String()+"/share-links", "token-ana", "")
		if rec.Code != http.StatusCreated {
			t.Fatalf("POST share-links: status = %d", rec.Code)
		}
		return decode[api.CreatedShareLink](t, rec)
	}
	rex := testAPI.createPet("token-ana", `{"name": "Rex", "species": "dog"}`)
	expired := create(rex)
	const expire = `UPDATE share_links SET expires_at = now() - interval '1 second' WHERE id = $1`
	if _, err := testAPI.pool.Exec(t.Context(), expire, expired.Id); err != nil {
		t.Fatalf("expire the link: %v", err)
	}
	mel := testAPI.createPet("token-ana", `{"name": "Mel", "species": "cat"}`)
	ofDeletedPet := create(mel)
	if rec := testAPI.call(http.MethodDelete, "/v1/pets/"+mel.Id.String(), "token-ana", ""); rec.Code != http.StatusNoContent {
		t.Fatalf("DELETE pet: status = %d", rec.Code)
	}
	unknown := base64.RawURLEncoding.EncodeToString(make([]byte, 32))

	revoked := create(rex)
	revokePath := "/v1/pets/" + rex.Id.String() + "/share-links/" + revoked.Id.String()
	if rec := testAPI.call(http.MethodDelete, revokePath, "token-ana", ""); rec.Code != http.StatusNoContent {
		t.Fatalf("DELETE share link: status = %d", rec.Code)
	}
	_, want := testAPI.openCard(unknown)
	for name, token := range map[string]string{
		"unknown": unknown, "expired": expired.Token, "of a deleted pet": ofDeletedPet.Token,
		"revoked": revoked.Token,
	} {
		// RN-41: a mesma resposta 404 para todos os casos.
		if status, body := testAPI.openCard(token); status != http.StatusNotFound || string(body) != string(want) {
			t.Errorf("open a link %s: status = %d, body %s, want 404 and %s", name, status, body, want)
		}
	}
	// RN-40: um link vencido ou revogado não vem na lista.
	list := decode[api.ShareLinkList](t, testAPI.call(http.MethodGet, "/v1/pets/"+rex.Id.String()+"/share-links", "token-ana", ""))
	if len(list.Links) != 0 {
		t.Errorf("links = %+v, want none: the links are expired or revoked", list.Links)
	}
	// An open that fails does not count.
	var opens int
	const count = `SELECT opens FROM share_links WHERE id = $1`
	if err := testAPI.pool.QueryRow(t.Context(), count, expired.Id).Scan(&opens); err != nil || opens != 0 {
		t.Errorf("opens of the expired link = %d (%v), want 0", opens, err)
	}
}

// RN-43: um endpoint público aceita no máximo 10 POST por minuto, por IP e
// por caminho. The open of the card is a public POST.
func TestShareLinkOpeningHasARateLimit(t *testing.T) {
	testAPI := petsAPI(t)
	post := func() int {
		req := httptest.NewRequest(http.MethodPost, "/v1/share-links/opening", strings.NewReader(`{"token": "x"}`))
		req.Header.Set("Content-Type", "application/json")
		req.RemoteAddr = "203.0.113.10:4000"
		rec := httptest.NewRecorder()
		testAPI.handler.ServeHTTP(rec, req)
		return rec.Code
	}
	for i := range 10 {
		if status := post(); status != http.StatusNotFound {
			t.Fatalf("request %d: status = %d, want 404", i+1, status)
		}
	}
	if status := post(); status != http.StatusTooManyRequests {
		t.Errorf("request 11: status = %d, want 429", status)
	}
}
