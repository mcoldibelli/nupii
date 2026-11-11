//go:build integration

package main

import (
	"context"
	"encoding/json"
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/mcoldibelli/nupii/backend/internal/api"
)

// publicJSON sends a JSON body with no token, from a new address.
func (a testAPI) publicJSON(method, path, body string) *httptest.ResponseRecorder {
	a.t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	req.RemoteAddr = randomAddress()
	rec := httptest.NewRecorder()
	a.handler.ServeHTTP(rec, req)
	validateResponse(a.t, req, rec.Code, rec.Header(), rec.Body.Bytes())
	return rec
}

// reportLost registers the pet as lost with the token, and returns the report.
func (a testAPI) reportLost(token string, pet api.Pet, body string) api.Report {
	a.t.Helper()
	full := `{"petId": "` + pet.Id.String() + `", ` + body + `}`
	rec := a.call(http.MethodPost, "/v1/reports/lost", token, full)
	if rec.Code != http.StatusCreated {
		a.t.Fatalf("POST /v1/reports/lost: status = %d, want 201, body %s", rec.Code, rec.Body)
	}
	return decode[api.Report](a.t, rec)
}

// reportFound publishes a found report and deletes it when the test ends.
func (a testAPI) reportFound(fields map[string]string, photo []byte) *httptest.ResponseRecorder {
	a.t.Helper()
	rec := a.public("/v1/reports/found", fields, photo)
	if rec.Code == http.StatusCreated {
		var created api.FoundReportCreated
		if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
			a.t.Fatalf("decode the found report: %v", err)
		}
		a.t.Cleanup(func() {
			ctx := context.WithoutCancel(a.t.Context())
			if _, err := a.pool.Exec(ctx, "DELETE FROM reports WHERE id = $1", created.Report.Id.String()); err != nil {
				a.t.Errorf("delete the found report of the test: %v", err)
			}
		})
	}
	return rec
}

func (a testAPI) board(page string) api.ReportPage {
	a.t.Helper()
	rec := a.publicJSON(http.MethodGet, "/v1/reports?page="+page, "")
	if rec.Code != http.StatusOK {
		a.t.Fatalf("GET /v1/reports: status = %d, body %s", rec.Code, rec.Body)
	}
	return decode[api.ReportPage](a.t, rec)
}

func onBoard(page api.ReportPage, id string) bool {
	for _, report := range page.Reports {
		if report.Id.String() == id {
			return true
		}
	}
	return false
}

func TestLostReportLifecycle(t *testing.T) {
	testAPI := petsAPI(t)
	pet := testAPI.createPet("token-ana", `{"name": "Rex", "species": "dog"}`)
	before := testAPI.board("1")

	report := testAPI.reportLost("token-ana", pet,
		`"latitude": -23.5505, "longitude": -46.6333, "place": "  Praça da Sé ", "description": "Coleira azul."`)

	if report.Type != api.ReportTypeLost || report.Status != api.ReportStatusOpen ||
		report.PetName == nil || *report.PetName != "Rex" || report.Place == nil || *report.Place != "Praça da Sé" {
		t.Errorf("report = %+v, want an open lost report of Rex at Praça da Sé", report)
	}
	// RN-71: sem data, vale o momento do registro.
	if time.Since(report.OccurredAt) > time.Minute {
		t.Errorf("occurredAt = %v, want the time of the registration", report.OccurredAt)
	}
	// RN-24: o mural tem o desaparecimento, com as contagens.
	board := testAPI.board("1")
	if !onBoard(board, report.Id.String()) || board.OpenLost != before.OpenLost+1 {
		t.Errorf("the board has the report: %t, open lost %d, want true and %d",
			onBoard(board, report.Id.String()), board.OpenLost, before.OpenLost+1)
	}
	// RN-72: o mural e a ficha não têm dado do autor.
	for _, ownerData := range []string{"Ana Lima", "ana@example.com", "ownerId"} {
		if strings.Contains(testAPI.publicJSON(http.MethodGet, "/v1/reports/"+report.Id.String(), "").Body.String(), ownerData) {
			t.Errorf("the detail has %q", ownerData)
		}
	}

	// RN-68: um pet tem no máximo um desaparecimento aberto.
	rec := testAPI.call(http.MethodPost, "/v1/reports/lost", "token-ana",
		`{"petId": "`+pet.Id.String()+`", "latitude": 1, "longitude": 1}`)
	if rec.Code != http.StatusConflict || decode[api.Error](t, rec).Error != api.ErrorCodeLostReportOpen {
		t.Errorf("second lost report: status = %d, body %s, want 409 lost_report_open", rec.Code, rec.Body)
	}

	// RF-20, RN-28: avistamento com o ponto, e sem o ponto.
	path := "/v1/reports/" + report.Id.String()
	rec = testAPI.publicJSON(http.MethodPost, path+"/sightings",
		`{"latitude": -23.56, "longitude": -46.64, "description": "Vi perto do metrô."}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("POST sightings: status = %d, want 201, body %s", rec.Code, rec.Body)
	}
	rec = testAPI.publicJSON(http.MethodPost, path+"/sightings", `{}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("POST sightings with no point: status = %d, want 201, body %s", rec.Code, rec.Body)
	}
	if got := decode[api.Sighting](t, rec); got.Latitude != -23.5505 || got.Longitude != -46.6333 {
		t.Errorf("sighting with no point at %v, %v, want the point of the lost report", got.Latitude, got.Longitude)
	}
	// RN-25: a ficha tem os avistamentos, do mais antigo para o mais novo.
	detail := decode[api.Report](t, testAPI.publicJSON(http.MethodGet, path, ""))
	if len(detail.Sightings) != 2 || detail.Sightings[0].Description == nil ||
		*detail.Sightings[0].Description != "Vi perto do metrô." {
		t.Errorf("sightings = %+v, want 2, the oldest first", detail.Sightings)
	}

	// RN-29: só o autor resolve.
	if rec := testAPI.call(http.MethodPost, path+"/resolution", "token-bia", ""); rec.Code != http.StatusNotFound {
		t.Errorf("resolution by another owner: status = %d, want 404", rec.Code)
	}
	rec = testAPI.call(http.MethodPost, path+"/resolution", "token-ana", "")
	if rec.Code != http.StatusOK || decode[api.Report](t, rec).Status != api.ReportStatusResolved {
		t.Fatalf("resolution: status = %d, body %s, want 200 resolved", rec.Code, rec.Body)
	}
	// RN-29: resolver de novo não muda nada.
	if rec := testAPI.call(http.MethodPost, path+"/resolution", "token-ana", ""); rec.Code != http.StatusOK {
		t.Errorf("second resolution: status = %d, want 200", rec.Code)
	}
	// RN-29: uma ocorrência resolvida sai do mural e não recebe avistamentos.
	if onBoard(testAPI.board("1"), report.Id.String()) {
		t.Error("the resolved report is on the board")
	}
	rec = testAPI.publicJSON(http.MethodPost, path+"/sightings", `{}`)
	if rec.Code != http.StatusConflict || decode[api.Error](t, rec).Error != api.ErrorCodeReportNotOpen {
		t.Errorf("sighting of a resolved report: status = %d, body %s, want 409 report_not_open", rec.Code, rec.Body)
	}
	// A new lost report of the same pet is allowed after the resolution.
	testAPI.reportLost("token-ana", pet, `"latitude": 1, "longitude": 1`)

	mine := decode[api.ReportList](t, testAPI.call(http.MethodGet, "/v1/me/reports", "token-ana", ""))
	if len(mine.Reports) != 2 || mine.Reports[0].Status != api.ReportStatusOpen ||
		mine.Reports[1].Status != api.ReportStatusResolved {
		t.Errorf("my reports = %+v, want the new open report and then the resolved one", mine.Reports)
	}
}

func TestLostReportRefusals(t *testing.T) {
	testAPI := petsAPI(t)
	pet := testAPI.createPet("token-ana", `{"name": "Rex", "species": "dog"}`)
	future := time.Now().Add(time.Hour).UTC().Format(time.RFC3339)
	tests := []struct {
		name       string
		token      string
		body       string
		wantStatus int
		wantCode   api.ErrorCode
	}{
		{name: "RN-26 pet of another owner", token: "token-bia",
			body: `"latitude": 1, "longitude": 1`, wantStatus: http.StatusNotFound, wantCode: api.ErrorCodePetNotFound},
		{name: "RN-70 latitude out of the Earth", token: "token-ana",
			body: `"latitude": 91, "longitude": 1`, wantStatus: http.StatusBadRequest, wantCode: api.ErrorCodeInvalidRequest},
		{name: "RN-70 place with 201 characters", token: "token-ana",
			body:       `"latitude": 1, "longitude": 1, "place": "` + strings.Repeat("a", 201) + `"`,
			wantStatus: http.StatusBadRequest, wantCode: api.ErrorCodeInvalidRequest},
		{name: "RN-71 date in the future", token: "token-ana",
			body: `"latitude": 1, "longitude": 1, "occurredAt": "` + future + `"`, wantStatus: http.StatusBadRequest,
			wantCode: api.ErrorCodeInvalidRequest},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := testAPI.call(http.MethodPost, "/v1/reports/lost", tt.token,
				`{"petId": "`+pet.Id.String()+`", `+tt.body+`}`)
			if rec.Code != tt.wantStatus || decode[api.Error](t, rec).Error != tt.wantCode {
				t.Errorf("status = %d, body %s, want %d %s", rec.Code, rec.Body, tt.wantStatus, tt.wantCode)
			}
		})
	}
	if rec := testAPI.call(http.MethodPost, "/v1/reports/lost", "", `{}`); rec.Code != http.StatusUnauthorized {
		t.Errorf("no token: status = %d, want 401", rec.Code)
	}
}

// RN-68: with registrations at the same time, the pet has one open lost report.
func TestLostReportsAtTheSameTime(t *testing.T) {
	testAPI := petsAPI(t)
	pet := testAPI.createPet("token-ana", `{"name": "Rex", "species": "dog"}`)
	body := `{"petId": "` + pet.Id.String() + `", "latitude": 1, "longitude": 1}`
	statuses := make([]int, 6)
	var group sync.WaitGroup
	for i := range statuses {
		group.Go(func() { statuses[i] = testAPI.call(http.MethodPost, "/v1/reports/lost", "token-ana", body).Code })
	}
	group.Wait()

	created := 0
	for _, status := range statuses {
		switch status {
		case http.StatusCreated:
			created++
		case http.StatusConflict:
		default:
			t.Errorf("status %d, want 201 or 409", status)
		}
	}
	if created != 1 {
		t.Errorf("%d lost reports created, want 1", created)
	}
}

func TestLostReportOfADeletedPetLeavesTheBoard(t *testing.T) {
	testAPI := petsAPI(t)
	pet := testAPI.createPet("token-ana", `{"name": "Rex", "species": "dog"}`)
	report := testAPI.reportLost("token-ana", pet, `"latitude": 1, "longitude": 1`)
	if rec := testAPI.call(http.MethodDelete, "/v1/pets/"+pet.Id.String(), "token-ana", ""); rec.Code != http.StatusNoContent {
		t.Fatalf("delete the pet: status = %d", rec.Code)
	}

	// RN-24: um desaparecimento de um pet excluído sai do mural.
	if onBoard(testAPI.board("1"), report.Id.String()) {
		t.Error("the report of a deleted pet is on the board")
	}
	if rec := testAPI.publicJSON(http.MethodGet, "/v1/reports/"+report.Id.String(), ""); rec.Code != http.StatusNotFound {
		t.Errorf("detail of the report of a deleted pet: status = %d, want 404", rec.Code)
	}
}

func TestFoundReport(t *testing.T) {
	testAPI := petsAPI(t)
	photo := nosePhoto()
	rec := testAPI.reportFound(map[string]string{
		"latitude": "-23.55", "longitude": "-46.63", "place": "Rua Augusta", "description": "Está comigo.",
	}, photo)
	if rec.Code != http.StatusCreated {
		t.Fatalf("POST /v1/reports/found: status = %d, want 201, body %s", rec.Code, rec.Body)
	}
	created := decode[api.FoundReportCreated](t, rec)
	report := created.Report
	if report.Type != api.ReportTypeFound || report.PetId != nil || report.PhotoUrl == nil {
		t.Errorf("report = %+v, want a found report with a photo and no pet", report)
	}
	// RN-27: a foto do achado é a foto do focinho.
	if status, body := readURL(t, *report.PhotoUrl); status != http.StatusOK || string(body) != string(photo) {
		t.Errorf("read of photoUrl: status %d, want 200 and the photo sent", status)
	}
	// RN-69: o código tem 256 bits, e só o SHA-256 vai para o banco.
	if len(created.ResolveCode) != 43 {
		t.Errorf("resolveCode has %d characters, want 43", len(created.ResolveCode))
	}
	var stored []byte
	const read = "SELECT resolve_code_hash FROM reports WHERE id = $1"
	if err := testAPI.pool.QueryRow(t.Context(), read, report.Id.String()).Scan(&stored); err != nil {
		t.Fatalf("read the report: %v", err)
	}
	if len(stored) != 32 || strings.Contains(string(stored), created.ResolveCode) {
		t.Errorf("the database has %d bytes for the code, want the 32 bytes of the SHA-256", len(stored))
	}
	if !onBoard(testAPI.board("1"), report.Id.String()) {
		t.Error("the found report is not on the board")
	}
	// RN-28: um avistamento só entra em um desaparecimento.
	path := "/v1/reports/" + report.Id.String()
	if rec := testAPI.publicJSON(http.MethodPost, path+"/sightings", `{}`); rec.Code != http.StatusConflict {
		t.Errorf("sighting of a found report: status = %d, want 409", rec.Code)
	}

	// RN-69: quem tem o código resolve o achado.
	if rec := testAPI.publicJSON(http.MethodPost, path+"/code-resolution", `{"code": "wrong"}`); rec.Code != http.StatusNotFound {
		t.Errorf("resolution with a wrong code: status = %d, want 404", rec.Code)
	}
	rec = testAPI.publicJSON(http.MethodPost, path+"/code-resolution", `{"code": "`+created.ResolveCode+`"}`)
	if rec.Code != http.StatusOK || decode[api.Report](t, rec).Status != api.ReportStatusResolved {
		t.Errorf("resolution with the code: status = %d, body %s, want 200 resolved", rec.Code, rec.Body)
	}
	if onBoard(testAPI.board("1"), report.Id.String()) {
		t.Error("the resolved found report is on the board")
	}
}

func TestFoundReportRefusals(t *testing.T) {
	testAPI := petsAPI(t)
	point := map[string]string{"latitude": "1", "longitude": "1"}
	tests := []struct {
		name   string
		fields map[string]string
		photo  []byte
	}{
		{name: "RN-27 no photo", fields: point},
		{name: "RN-27 file that is not an image", fields: point, photo: []byte("a text file")},
		{name: "RN-27 image with more than 8 MB", fields: point, photo: append(nosePhoto(), make([]byte, 8<<20)...)},
		{name: "RN-70 no point", fields: map[string]string{}, photo: nosePhoto()},
		{name: "RN-70 latitude NaN", fields: map[string]string{"latitude": "NaN", "longitude": "1"}, photo: nosePhoto()},
		{name: "RN-70 description with 1001 characters",
			fields: map[string]string{"latitude": "1", "longitude": "1", "description": strings.Repeat("a", 1001)},
			photo:  nosePhoto()},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := testAPI.reportFound(tt.fields, tt.photo)
			if rec.Code != http.StatusBadRequest || decode[api.Error](t, rec).Error != api.ErrorCodeInvalidRequest {
				t.Errorf("status = %d, body %s, want 400 invalid_request", rec.Code, rec.Body)
			}
		})
	}
}

func TestSightingRefusals(t *testing.T) {
	testAPI := petsAPI(t)
	pet := testAPI.createPet("token-ana", `{"name": "Rex", "species": "dog"}`)
	path := "/v1/reports/" + testAPI.reportLost("token-ana", pet, `"latitude": 1, "longitude": 1`).Id.String()
	tests := []struct {
		name       string
		path       string
		body       string
		wantStatus int
	}{
		{name: "RN-28 latitude with no longitude", path: path, body: `{"latitude": 1}`, wantStatus: http.StatusBadRequest},
		{name: "RN-70 longitude out of the Earth", path: path, body: `{"latitude": 1, "longitude": 181}`,
			wantStatus: http.StatusBadRequest},
		{name: "report that does not exist", path: "/v1/reports/0195f3c8-7a55-7c1e-9d2a-0d1c2b3a4f5e",
			body: `{}`, wantStatus: http.StatusNotFound},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if rec := testAPI.publicJSON(http.MethodPost, tt.path+"/sightings", tt.body); rec.Code != tt.wantStatus {
				t.Errorf("status = %d, body %s, want %d", rec.Code, rec.Body, tt.wantStatus)
			}
		})
	}
}

// RN-24: 20 ocorrências por página.
func TestBoardPages(t *testing.T) {
	testAPI := petsAPI(t)
	for range 21 {
		if rec := testAPI.reportFound(map[string]string{"latitude": "1", "longitude": "1"}, nosePhoto()); rec.Code != http.StatusCreated {
			t.Fatalf("POST /v1/reports/found: status = %d", rec.Code)
		}
	}
	first, second := testAPI.board("1"), testAPI.board("2")
	if len(first.Reports) != 20 || !first.HasNext || first.Page != 1 {
		t.Errorf("page 1 has %d reports, hasNext %t, want 20 and true", len(first.Reports), first.HasNext)
	}
	// From the newest to the oldest, with no report in two pages.
	for i := 1; i < len(first.Reports); i++ {
		if first.Reports[i].CreatedAt.After(first.Reports[i-1].CreatedAt) {
			t.Fatalf("report %d is newer than report %d", i, i-1)
		}
	}
	if len(second.Reports) == 0 || onBoard(first, second.Reports[0].Id.String()) {
		t.Error("page 2 is empty or repeats a report of page 1")
	}
	if first.OpenFound < 21 || math.Abs(float64(first.OpenFound-second.OpenFound)) > 0 {
		t.Errorf("open found = %d and %d, want the same count of at least 21", first.OpenFound, second.OpenFound)
	}
	if rec := testAPI.publicJSON(http.MethodGet, "/v1/reports?page=0", ""); rec.Code != http.StatusBadRequest {
		t.Errorf("page 0: status = %d, want 400", rec.Code)
	}
}
