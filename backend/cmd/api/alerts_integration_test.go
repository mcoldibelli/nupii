//go:build integration

package main

import (
	"log/slog"
	"net/http"
	"strings"
	"testing"

	"github.com/mcoldibelli/nupii/backend/internal/alerts"
	"github.com/mcoldibelli/nupii/backend/internal/api"
	"github.com/mcoldibelli/nupii/backend/internal/platform/jobs"
)

// runJobs runs the notification jobs that are due, as the runner of the
// API does after the start.
func (a testAPI) runJobs() {
	a.t.Helper()
	runner := jobs.NewRunner(a.pool, slog.New(slog.DiscardHandler), alerts.JobHandlers())
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

func (a testAPI) notifications(token string) []api.Notification {
	a.t.Helper()
	rec := a.call(http.MethodGet, "/v1/notifications", token, "")
	if rec.Code != http.StatusOK {
		a.t.Fatalf("GET /v1/notifications: status = %d, body %s", rec.Code, rec.Body)
	}
	return decode[api.NotificationList](a.t, rec).Notifications
}

func (a testAPI) setLocation(token, body string) int {
	a.t.Helper()
	return a.call(http.MethodPut, "/v1/me/location", token, body).Code
}

// The criterion of slice 6: an owner less than 3.000 m away gets the
// notification. With the API stopped right after the registration, the
// notification comes at the next start (RNF-01).
func TestNearbyAlert(t *testing.T) {
	testAPI := petsAPI(t)
	// Bia is about 1.100 m north of the point of the lost report. Ana is
	// the author and is at the point.
	if status := testAPI.setLocation("token-bia", `{"latitude": -23.5405, "longitude": -46.6333}`); status != http.StatusNoContent {
		t.Fatalf("PUT location of Bia: status = %d, want 204", status)
	}
	if status := testAPI.setLocation("token-ana", `{"latitude": -23.5505, "longitude": -46.6333}`); status != http.StatusNoContent {
		t.Fatalf("PUT location of Ana: status = %d, want 204", status)
	}
	pet := testAPI.createPet("token-ana", `{"name": "Rex", "species": "dog"}`)
	report := testAPI.reportLost("token-ana", pet, `"latitude": -23.5505, "longitude": -46.6333, "place": "Praça da Sé"`)

	// The API is stopped: no runner. The job waits in the database.
	var pending int
	const query = "SELECT count(*) FROM jobs WHERE kind = 'notify_lost_report' AND status = 'pending' AND payload->>'reportId' = $1"
	if err := testAPI.pool.QueryRow(t.Context(), query, report.Id.String()).Scan(&pending); err != nil || pending != 1 {
		t.Fatalf("pending jobs of the report = %d, %v, want 1", pending, err)
	}
	if got := testAPI.notifications("token-bia"); len(got) != 0 {
		t.Fatalf("Bia has %d notifications before the jobs run, want 0", len(got))
	}

	// The next start runs the job.
	testAPI.runJobs()

	got := testAPI.notifications("token-bia")
	if len(got) != 1 {
		t.Fatalf("Bia has %d notifications, want 1 (RN-32)", len(got))
	}
	alert := got[0]
	if alert.Kind != api.NotificationKindLostNearby || alert.ReportId == nil || *alert.ReportId != report.Id ||
		alert.DistanceMeters == nil || *alert.DistanceMeters < 1000 || *alert.DistanceMeters > 1200 || alert.Read {
		t.Errorf("notification = %+v, want an unread nearby alert of the report at about 1.100 m", alert)
	}
	if !strings.Contains(alert.Body, "Rex sumiu perto de Praça da Sé") {
		t.Errorf("body = %q, want the pet and the place", alert.Body)
	}
	// RN-34: o autor não recebe o alerta de proximidade.
	if got := testAPI.notifications("token-ana"); len(got) != 0 {
		t.Errorf("Ana, the author, has %d notifications, want 0", len(got))
	}

	// RNF-02: a tarefa é segura para executar duas vezes.
	if _, err := testAPI.pool.Exec(t.Context(), "UPDATE jobs SET status = 'pending' WHERE kind = 'notify_lost_report' AND payload->>'reportId' = $1", report.Id.String()); err != nil {
		t.Fatalf("run the job again: %v", err)
	}
	testAPI.runJobs()
	if got := testAPI.notifications("token-bia"); len(got) != 1 {
		t.Errorf("after the job runs two times, Bia has %d notifications, want 1", len(got))
	}

	// RN-74: marcar como lida; de novo não muda nada; de outro tutor não existe.
	path := "/v1/notifications/" + alert.Id.String() + "/read"
	if rec := testAPI.call(http.MethodPost, path, "token-ana", ""); rec.Code != http.StatusNotFound ||
		decode[api.Error](t, rec).Error != api.ErrorCodeNotificationNotFound {
		t.Errorf("read by another owner: status = %d, want 404 notification_not_found", rec.Code)
	}
	for range 2 {
		if rec := testAPI.call(http.MethodPost, path, "token-bia", ""); rec.Code != http.StatusNoContent {
			t.Fatalf("read: status = %d, want 204", rec.Code)
		}
	}
	if got := testAPI.notifications("token-bia"); len(got) != 1 || !got[0].Read {
		t.Errorf("notifications of Bia = %+v, want 1 read", got)
	}
}

func TestNearbyAlertDistance(t *testing.T) {
	testAPI := petsAPI(t)
	// Bia is about 3.330 m away: out of the radius of RN-32.
	if status := testAPI.setLocation("token-bia", `{"latitude": -23.5205, "longitude": -46.6333}`); status != http.StatusNoContent {
		t.Fatalf("PUT location: status = %d", status)
	}
	pet := testAPI.createPet("token-ana", `{"name": "Rex", "species": "dog"}`)
	testAPI.reportLost("token-ana", pet, `"latitude": -23.5505, "longitude": -46.6333`)
	testAPI.runJobs()

	if got := testAPI.notifications("token-bia"); len(got) != 0 {
		t.Errorf("Bia, at 3.330 m, has %d notifications, want 0 (RN-32)", len(got))
	}
}

// RN-73: um avistamento cria uma notificação para o tutor do pet. Uma
// confirmação de encontro também (RN-16).
func TestSightingAndFoundNotifications(t *testing.T) {
	testAPI := petsAPI(t)
	pet := testAPI.createPet("token-ana", `{"name": "Rex", "species": "dog"}`)
	report := testAPI.reportLost("token-ana", pet, `"latitude": -23.5505, "longitude": -46.6333`)
	rec := testAPI.publicJSON(http.MethodPost, "/v1/reports/"+report.Id.String()+"/sightings", `{"place": "Rua Direita"}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("POST sighting: status = %d", rec.Code)
	}

	g := newGallery(testAPI)
	testAPI.dogWithNoses(g, "token-ana", "Mel", 10, 0.90)
	found := decode[api.Identification](t, testAPI.public("/v1/identifications", nil, g.queryPhoto()))
	if len(found.Candidates) != 1 {
		t.Fatalf("%d candidates, want Mel", len(found.Candidates))
	}
	confirmation := "/v1/identifications/" + found.Id.String() + "/confirmation"
	contact := map[string]string{"candidateId": found.Candidates[0].Id.String(), "name": "Caio", "phone": "11 98888-7777"}
	for range 2 {
		if rec := testAPI.public(confirmation, contact, nil); rec.Code != http.StatusNoContent {
			t.Fatalf("POST confirmation: status = %d", rec.Code)
		}
	}
	testAPI.runJobs()

	got := testAPI.notifications("token-ana")
	if len(got) != 2 {
		t.Fatalf("Ana has %d notifications, want 2 (a sighting and one found): %+v", len(got), got)
	}
	// RN-35: da mais nova para a mais antiga.
	if got[0].Kind != api.NotificationKindFound || got[0].Title != "Alguém encontrou Mel" ||
		!strings.Contains(got[0].Body, "Caio reconheceu Mel") {
		t.Errorf("newest notification = %+v, want the found Mel", got[0])
	}
	if got[1].Kind != api.NotificationKindSighting || got[1].Title != "Alguém viu Rex" ||
		got[1].ReportId == nil || *got[1].ReportId != report.Id {
		t.Errorf("older notification = %+v, want the sighting of Rex", got[1])
	}
}

func TestLocationRefusals(t *testing.T) {
	testAPI := petsAPI(t)
	for _, body := range []string{`{"latitude": 91, "longitude": 0}`, `{"latitude": 0, "longitude": -181}`} {
		if status := testAPI.setLocation("token-ana", body); status != http.StatusBadRequest {
			t.Errorf("RN-75 %s: status = %d, want 400", body, status)
		}
	}
	if status := testAPI.setLocation("token-new", `{"latitude": 0, "longitude": 0}`); status != http.StatusNotFound {
		t.Errorf("account with no owner: status = %d, want 404", status)
	}
}
