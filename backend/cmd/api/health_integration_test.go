//go:build integration

package main

import (
	"bytes"
	"errors"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/mcoldibelli/nupii/backend/internal/api"
)

func dateText(offset int) string {
	return time.Now().UTC().AddDate(0, 0, offset).Format(time.DateOnly)
}

func (a testAPI) createEvent(token string, pet api.Pet, body string) api.HealthEvent {
	a.t.Helper()
	rec := a.call(http.MethodPost, "/v1/pets/"+pet.Id.String()+"/health-events", token, body)
	if rec.Code != http.StatusCreated {
		a.t.Fatalf("POST health-events %s: status = %d, body %s", body, rec.Code, rec.Body)
	}
	return decode[api.HealthEvent](a.t, rec)
}

// RF-27: o tutor cria, lista, altera e apaga os eventos de saúde dos cinco tipos.
func TestHealthEventsOfTheFiveTypes(t *testing.T) {
	testAPI := petsAPI(t)
	pet := testAPI.createPet("token-ana", `{"name": "Rex", "species": "dog"}`)
	bodies := []string{
		`{"type": "vaccine", "date": "` + dateText(-30) + `", "name": "V10", "nextDoseDate": "` + dateText(335) + `", "remind": true}`,
		`{"type": "consultation", "date": "` + dateText(-20) + `", "reason": "Tosse", "weightKg": 12.35}`,
		`{"type": "medication", "date": "` + dateText(-10) + `", "name": "Bravecto", "medicationCategory": "flea", "intervalDays": 90, "inUse": true, "remind": true}`,
		`{"type": "exam", "date": "` + dateText(-5) + `", "name": "Hemograma", "result": "Normal"}`,
		`{"type": "note", "date": "` + dateText(0) + `", "noteCategory": "weight", "title": "Pesagem", "weightKg": 12.5}`,
	}
	created := make([]api.HealthEvent, 0, len(bodies))
	for _, body := range bodies {
		created = append(created, testAPI.createEvent("token-ana", pet, body))
	}

	path := "/v1/pets/" + pet.Id.String() + "/health-events"
	list := decode[api.HealthEventList](t, testAPI.call(http.MethodGet, path, "token-ana", ""))
	if len(list.Events) != 5 || list.Events[0].Type != api.HealthEventTypeNote ||
		list.Events[4].Type != api.HealthEventTypeVaccine {
		t.Fatalf("events = %+v, want the 5, from the newest date to the oldest", list.Events)
	}

	// PUT replaces all the data: the exam loses its result.
	exam := path + "/" + created[3].Id.String()
	rec := testAPI.call(http.MethodPut, exam, "token-ana", `{"type": "exam", "date": "`+dateText(-5)+`", "name": "Raio X"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("PUT exam: status = %d, body %s", rec.Code, rec.Body)
	}
	if updated := decode[api.HealthEvent](t, rec); *updated.Name != "Raio X" || updated.Result != nil {
		t.Errorf("updated exam = %+v, want the new name and no result", updated)
	}

	for _, event := range created {
		if rec := testAPI.call(http.MethodDelete, path+"/"+event.Id.String(), "token-ana", ""); rec.Code != http.StatusNoContent {
			t.Errorf("DELETE %s: status = %d", event.Type, rec.Code)
		}
	}
	if got := decode[api.HealthEventList](t, testAPI.call(http.MethodGet, path, "token-ana", "")); len(got.Events) != 0 {
		t.Errorf("%d events after the deletes, want 0", len(got.Events))
	}
	if rec := testAPI.call(http.MethodDelete, exam, "token-ana", ""); rec.Code != http.StatusNotFound ||
		decode[api.Error](t, rec).Error != api.ErrorCodeHealthEventNotFound {
		t.Errorf("DELETE again: status = %d, want 404 health_event_not_found", rec.Code)
	}
}

// RN-76: só o tutor do pet vê e muda os eventos dele.
// RN-52, RN-76: só o tutor do pet vê e muda os eventos dele.
func TestHealthEventsOfAnotherOwner(t *testing.T) {
	testAPI := petsAPI(t)
	pet := testAPI.createPet("token-ana", `{"name": "Rex", "species": "dog"}`)
	event := testAPI.createEvent("token-ana", pet, `{"type": "exam", "date": "`+dateText(0)+`", "name": "Hemograma"}`)
	path := "/v1/pets/" + pet.Id.String() + "/health-events"
	other := testAPI.createPet("token-bia", `{"name": "Mel", "species": "dog"}`)

	for _, call := range []struct {
		method, path, body string
	}{
		{http.MethodGet, path, ""},
		{http.MethodPost, path, `{"type": "exam", "date": "` + dateText(0) + `", "name": "X"}`},
		{http.MethodPut, path + "/" + event.Id.String(), `{"type": "exam", "date": "` + dateText(0) + `", "name": "X"}`},
		{http.MethodDelete, path + "/" + event.Id.String(), ""},
	} {
		if rec := testAPI.call(call.method, call.path, "token-bia", call.body); rec.Code != http.StatusNotFound {
			t.Errorf("%s %s by Bia: status = %d, want 404", call.method, call.path, rec.Code)
		}
	}
	// The event of Ana is not an event of the pet of Bia.
	otherPath := "/v1/pets/" + other.Id.String() + "/health-events/" + event.Id.String()
	if rec := testAPI.call(http.MethodDelete, otherPath, "token-bia", ""); rec.Code != http.StatusNotFound ||
		decode[api.Error](t, rec).Error != api.ErrorCodeHealthEventNotFound {
		t.Errorf("DELETE the event of Ana through the pet of Bia: status = %d, want 404", rec.Code)
	}
}

func TestHealthEventRefusals(t *testing.T) {
	testAPI := petsAPI(t)
	pet := testAPI.createPet("token-ana", `{"name": "Rex", "species": "dog"}`)
	for _, body := range []string{
		`{"type": "vaccine", "date": "` + dateText(1) + `", "name": "V10"}`,
		`{"type": "exam", "date": "` + dateText(0) + `", "name": "X", "reason": "Tosse"}`,
		`{"type": "medication", "date": "` + dateText(0) + `", "name": "X", "medicationCategory": "flea", "intervalDays": 400}`,
		`{"type": "note", "date": "` + dateText(0) + `", "noteCategory": "weight"}`,
		// RN-37, RN-77: com a opção de lembrar, a medicação tem o intervalo e a
		// vacina tem a próxima dose.
		`{"type": "medication", "date": "` + dateText(0) + `", "name": "X", "medicationCategory": "flea", "remind": true}`,
		`{"type": "vaccine", "date": "` + dateText(0) + `", "name": "V10", "remind": true}`,
	} {
		rec := testAPI.call(http.MethodPost, "/v1/pets/"+pet.Id.String()+"/health-events", "token-ana", body)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("POST %s: status = %d, want 400", body, rec.Code)
		}
	}
}

// RN-81: os próximos cuidados, da data mais próxima para a mais distante, e só
// o evento mais novo de cada vacina pelo nome e de cada medicação pela categoria
// ou pelo nome.
func TestUpcomingCare(t *testing.T) {
	testAPI := petsAPI(t)
	rex := testAPI.createPet("token-ana", `{"name": "Rex", "species": "dog"}`)
	mel := testAPI.createPet("token-ana", `{"name": "Mel", "species": "cat"}`)
	// The old V10 of Rex is replaced by the new one: only the new one counts.
	testAPI.createEvent("token-ana", rex, `{"type": "vaccine", "date": "`+dateText(-400)+`", "name": "V10", "nextDoseDate": "`+dateText(-35)+`", "remind": true}`)
	v10 := testAPI.createEvent("token-ana", rex, `{"type": "vaccine", "date": "`+dateText(-30)+`", "name": "v10", "nextDoseDate": "`+dateText(335)+`", "remind": true}`)
	// Two flea medications of different brands: the category groups them.
	testAPI.createEvent("token-ana", rex, `{"type": "medication", "date": "`+dateText(-100)+`", "name": "Simparic", "medicationCategory": "flea", "intervalDays": 30, "remind": true}`)
	flea := testAPI.createEvent("token-ana", rex, `{"type": "medication", "date": "`+dateText(-10)+`", "name": "Bravecto", "medicationCategory": "flea", "intervalDays": 90, "remind": true}`)
	// A medication of Mel that is late: the due date is in the past.
	late := testAPI.createEvent("token-ana", mel, `{"type": "medication", "date": "`+dateText(-20)+`", "name": "Vermífugo", "medicationCategory": "deworm", "intervalDays": 15, "remind": true}`)
	// Not in the list: no reminder, not in use, and the pet of Bia.
	testAPI.createEvent("token-ana", rex, `{"type": "vaccine", "date": "`+dateText(-1)+`", "name": "Raiva", "nextDoseDate": "`+dateText(364)+`"}`)
	testAPI.createEvent("token-ana", mel, `{"type": "medication", "date": "`+dateText(-1)+`", "name": "Antibiótico", "medicationCategory": "medication", "intervalDays": 1, "inUse": false, "remind": true}`)
	// Other medications group by the name: only the new Prednisona counts.
	testAPI.createEvent("token-ana", mel, `{"type": "medication", "date": "`+dateText(-50)+`", "name": "Prednisona", "medicationCategory": "medication", "intervalDays": 10, "remind": true}`)
	pred := testAPI.createEvent("token-ana", mel, `{"type": "medication", "date": "`+dateText(-2)+`", "name": "prednisona", "medicationCategory": "medication", "intervalDays": 100, "remind": true}`)
	// The newest Gripe has no reminder, so the old Gripe is not in the list.
	testAPI.createEvent("token-ana", rex, `{"type": "vaccine", "date": "`+dateText(-300)+`", "name": "Gripe", "nextDoseDate": "`+dateText(65)+`", "remind": true}`)
	testAPI.createEvent("token-ana", rex, `{"type": "vaccine", "date": "`+dateText(-3)+`", "name": "Gripe"}`)
	// A deleted pet is not in the list.
	gone := testAPI.createPet("token-ana", `{"name": "Zeca", "species": "dog"}`)
	testAPI.createEvent("token-ana", gone, `{"type": "vaccine", "date": "`+dateText(0)+`", "name": "V8", "nextDoseDate": "`+dateText(2)+`", "remind": true}`)
	if rec := testAPI.call(http.MethodDelete, "/v1/pets/"+gone.Id.String(), "token-ana", ""); rec.Code != http.StatusNoContent {
		t.Fatalf("DELETE pet: status = %d", rec.Code)
	}
	bob := testAPI.createPet("token-bia", `{"name": "Bob", "species": "dog"}`)
	testAPI.createEvent("token-bia", bob, `{"type": "vaccine", "date": "`+dateText(0)+`", "name": "V8", "nextDoseDate": "`+dateText(1)+`", "remind": true}`)

	rec := testAPI.call(http.MethodGet, "/v1/upcoming-care", "token-ana", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("GET upcoming-care: status = %d, body %s", rec.Code, rec.Body)
	}
	items := decode[api.UpcomingCareList](t, rec).Items
	want := []struct {
		event   api.HealthEvent
		pet     string
		dueDate string
	}{
		{late, "Mel", dateText(-5)},
		{flea, "Rex", dateText(80)},
		{pred, "Mel", dateText(98)},
		{v10, "Rex", dateText(335)},
	}
	if len(items) != len(want) {
		t.Fatalf("%d items, want %d: %+v", len(items), len(want), items)
	}
	for i, w := range want {
		item := items[i]
		if item.EventId != w.event.Id || item.PetName != w.pet || item.DueDate.Format(time.DateOnly) != w.dueDate {
			t.Errorf("item %d = %s %s %s, want %s %s %s", i, item.Title, item.PetName,
				item.DueDate.Format(time.DateOnly), *w.event.Name, w.pet, w.dueDate)
		}
	}
}

// RF-28: o tutor envia, lista e apaga os anexos de um evento de saúde.
func TestHealthAttachments(t *testing.T) {
	testAPI := petsAPI(t)
	pet := testAPI.createPet("token-ana", `{"name": "Rex", "species": "dog"}`)
	event := testAPI.createEvent("token-ana", pet, `{"type": "exam", "date": "`+dateText(0)+`", "name": "Hemograma"}`)
	path := "/v1/pets/" + pet.Id.String() + "/health-events/" + event.Id.String() + "/attachments"
	pdf := []byte("%PDF-1.7\nresultado")

	rec := testAPI.upload(http.MethodPost, "token-ana", path, pdf)
	if rec.Code != http.StatusCreated {
		t.Fatalf("POST attachment: status = %d, body %s", rec.Code, rec.Body)
	}
	first := decode[api.HealthAttachment](t, rec)
	if first.ContentType != "application/pdf" || first.SizeBytes != len(pdf) || first.FileName != "photo" {
		t.Errorf("attachment = %+v, want a PDF of %d bytes with the name of the part", first, len(pdf))
	}
	if !strings.Contains(first.Url, "X-Amz-Expires=900") {
		t.Errorf("url = %q, want a validity of 900 seconds (RN-06)", first.Url)
	}
	if status, body := readURL(t, first.Url); status != http.StatusOK || string(body) != string(pdf) {
		t.Errorf("read of the attachment: status %d, want 200 and the file", status)
	}

	// RN-82: o tipo é conferido pelo conteúdo, e um evento tem no máximo 10 anexos.
	if rec := testAPI.upload(http.MethodPost, "token-ana", path, []byte("a text file")); rec.Code != http.StatusBadRequest {
		t.Errorf("text file: status = %d, want 400", rec.Code)
	}
	for range 9 {
		if rec := testAPI.upload(http.MethodPost, "token-ana", path, nosePhoto()); rec.Code != http.StatusCreated {
			t.Fatalf("POST attachment: status = %d", rec.Code)
		}
	}
	if rec := testAPI.upload(http.MethodPost, "token-ana", path, nosePhoto()); rec.Code != http.StatusConflict ||
		decode[api.Error](t, rec).Error != api.ErrorCodeAttachmentLimit {
		t.Errorf("11th attachment: status = %d, want 409 attachment_limit", rec.Code)
	}
	list := decode[api.HealthAttachmentList](t, testAPI.call(http.MethodGet, path, "token-ana", ""))
	if len(list.Attachments) != 10 || list.Attachments[0].Id != first.Id {
		t.Fatalf("%d attachments, want 10 with the first one first", len(list.Attachments))
	}

	// RN-52: para outro tutor, o pet não existe, nem os anexos dele.
	if rec := testAPI.call(http.MethodGet, path, "token-bia", ""); rec.Code != http.StatusNotFound {
		t.Errorf("GET by Bia: status = %d, want 404", rec.Code)
	}

	if rec := testAPI.call(http.MethodDelete, path+"/"+first.Id.String(), "token-ana", ""); rec.Code != http.StatusNoContent {
		t.Fatalf("DELETE attachment: status = %d", rec.Code)
	}
	if status, _ := readURL(t, first.Url); status != http.StatusNotFound {
		t.Errorf("read of the deleted attachment: status %d, want 404", status)
	}

	// RN-82: apagar um evento apaga os anexos dele.
	second := list.Attachments[1]
	eventPath := "/v1/pets/" + pet.Id.String() + "/health-events/" + event.Id.String()
	if rec := testAPI.call(http.MethodDelete, eventPath, "token-ana", ""); rec.Code != http.StatusNoContent {
		t.Fatalf("DELETE event: status = %d, body %s", rec.Code, rec.Body)
	}
	if status, _ := readURL(t, second.Url); status != http.StatusNotFound {
		t.Errorf("read of an attachment of the deleted event: status %d, want 404", status)
	}
	if rec := testAPI.call(http.MethodGet, path, "token-ana", ""); rec.Code != http.StatusNotFound {
		t.Errorf("GET attachments of the deleted event: status = %d, want 404", rec.Code)
	}
}

// RN-82: um anexo tem até 10 MB, também pelo limite do corpo da API.
func TestHealthAttachmentOf10MB(t *testing.T) {
	testAPI := petsAPI(t)
	pet := testAPI.createPet("token-ana", `{"name": "Rex", "species": "dog"}`)
	event := testAPI.createEvent("token-ana", pet, `{"type": "exam", "date": "`+dateText(0)+`", "name": "Raio X"}`)
	path := "/v1/pets/" + pet.Id.String() + "/health-events/" + event.Id.String() + "/attachments"
	file := append([]byte("%PDF-1.7\n"), make([]byte, 10<<20-9)...)

	if rec := testAPI.upload(http.MethodPost, "token-ana", path, file); rec.Code != http.StatusCreated {
		t.Errorf("file of 10 MB: status = %d, body %s, want 201", rec.Code, rec.Body)
	}
	if rec := testAPI.upload(http.MethodPost, "token-ana", path, append(file, 0)); rec.Code != http.StatusBadRequest {
		t.Errorf("file of 10 MB and 1 byte: status = %d, want 400", rec.Code)
	}
}

// The name of an attachment comes from the field fileName, without the
// directories. The app sends it in this field (the fetch of Expo does not
// send the name of the part).
func TestHealthAttachmentName(t *testing.T) {
	testAPI := petsAPI(t)
	pet := testAPI.createPet("token-ana", `{"name": "Rex", "species": "dog"}`)
	event := testAPI.createEvent("token-ana", pet, `{"type": "exam", "date": "`+dateText(0)+`", "name": "Hemograma"}`)
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", "document%3A22")
	if err != nil {
		t.Fatalf("create the part: %v", err)
	}
	if _, err := part.Write([]byte("%PDF-1.7\nresultado")); err != nil {
		t.Fatalf("write the part: %v", err)
	}
	if err := writer.WriteField("fileName", "C:/exames/hemograma.pdf"); err != nil {
		t.Fatalf("write the field: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close the body: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/v1/pets/"+pet.Id.String()+"/health-events/"+event.Id.String()+"/attachments", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Authorization", "Bearer token-ana")
	rec := httptest.NewRecorder()
	testAPI.handler.ServeHTTP(rec, req)
	validateResponse(t, req, rec.Code, rec.Header(), rec.Body.Bytes())

	if rec.Code != http.StatusCreated || decode[api.HealthAttachment](t, rec).FileName != "hemograma.pdf" {
		t.Errorf("status = %d, body %s, want 201 with the name hemograma.pdf", rec.Code, rec.Body)
	}
}

// RN-82: um evento tem no máximo 10 anexos, também com envios ao mesmo tempo.
func TestHealthAttachmentsAtTheSameTime(t *testing.T) {
	testAPI := petsAPI(t)
	pet := testAPI.createPet("token-ana", `{"name": "Rex", "species": "dog"}`)
	event := testAPI.createEvent("token-ana", pet, `{"type": "exam", "date": "`+dateText(0)+`", "name": "Hemograma"}`)
	path := "/v1/pets/" + pet.Id.String() + "/health-events/" + event.Id.String() + "/attachments"
	const uploads = 12
	codes := make(chan int, uploads)
	var wg sync.WaitGroup
	for range uploads {
		wg.Go(func() { codes <- testAPI.upload(http.MethodPost, "token-ana", path, nosePhoto()).Code })
	}
	wg.Wait()
	close(codes)
	count := map[int]int{}
	for code := range codes {
		count[code]++
	}
	if count[http.StatusCreated] != 10 || count[http.StatusConflict] != 2 {
		t.Errorf("status codes = %v, want 10 times 201 and 2 times 409", count)
	}
}

// RN-82: apagar um evento apaga os anexos dele, também o anexo que outro
// pedido grava enquanto o evento é apagado.
func TestHealthEventDeleteDuringAnUpload(t *testing.T) {
	testAPI := petsAPI(t)
	ctx := t.Context()
	pet := testAPI.createPet("token-ana", `{"name": "Rex", "species": "dog"}`)
	event := testAPI.createEvent("token-ana", pet, `{"type": "exam", "date": "`+dateText(0)+`", "name": "Hemograma"}`)

	// The transaction does what an upload does: it locks the event and adds
	// an attachment.
	tx, err := testAPI.pool.Begin(ctx)
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	defer func() {
		if err := tx.Rollback(ctx); err != nil && !errors.Is(err, pgx.ErrTxClosed) {
			t.Errorf("rollback: %v", err)
		}
	}()
	if _, err := tx.Exec(ctx, `SELECT id FROM health_events WHERE id = $1 FOR UPDATE`, event.Id); err != nil {
		t.Fatalf("lock the event: %v", err)
	}
	const insert = `INSERT INTO health_attachments (event_id, key, content_type, file_name, size_bytes)
		VALUES ($1, 'health/race.pdf', 'application/pdf', 'race.pdf', 1)`
	if _, err := tx.Exec(ctx, insert, event.Id); err != nil {
		t.Fatalf("add an attachment: %v", err)
	}

	path := "/v1/pets/" + pet.Id.String() + "/health-events/" + event.Id.String()
	code := make(chan int, 1)
	go func() { code <- testAPI.call(http.MethodDelete, path, "token-ana", "").Code }()
	// The delete waits for the lock of the upload.
	const waiting = `SELECT count(*) FROM pg_stat_activity
		WHERE wait_event_type = 'Lock' AND query LIKE '%health_events%'`
	for deadline := time.Now().Add(5 * time.Second); ; {
		var count int
		if err := testAPI.pool.QueryRow(ctx, waiting).Scan(&count); err != nil {
			t.Fatalf("read the waiting queries: %v", err)
		}
		if count > 0 {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("the delete does not wait for the lock of the event")
		}
		time.Sleep(10 * time.Millisecond)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatalf("commit: %v", err)
	}
	if got := <-code; got != http.StatusNoContent {
		t.Fatalf("DELETE event: status = %d, want 204", got)
	}
	var left int
	const count = `SELECT count(*) FROM health_attachments WHERE event_id = $1`
	if err := testAPI.pool.QueryRow(ctx, count, event.Id).Scan(&left); err != nil {
		t.Fatalf("count the attachments: %v", err)
	}
	if left != 0 {
		t.Errorf("%d attachments of the deleted event, want 0", left)
	}
}
