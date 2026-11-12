//go:build integration

package main

import (
	"context"
	"crypto/rand"
	"net/http"
	"slices"
	"sync"
	"testing"

	"github.com/mcoldibelli/nupii/backend/internal/alerts"
)

// fakePusher is in the place of Firebase Cloud Messaging. It refuses the
// tokens of invalid and records the messages.
type fakePusher struct {
	mu       sync.Mutex
	invalid  []string
	messages []sentPush
}

type sentPush struct {
	tokens  []string
	message alerts.PushMessage
}

func (f *fakePusher) Send(_ context.Context, tokens []string, message alerts.PushMessage) (alerts.PushResult, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.messages = append(f.messages, sentPush{tokens: tokens, message: message})
	result := alerts.PushResult{}
	for _, token := range tokens {
		if slices.Contains(f.invalid, token) {
			result.InvalidTokens = append(result.InvalidTokens, token)
		} else {
			result.Sent++
		}
	}
	return result, nil
}

func (a testAPI) pushStatus(token string) string {
	a.t.Helper()
	var status string
	const query = "SELECT push_status FROM notifications WHERE id = $1"
	notifications := a.notifications(token)
	if len(notifications) != 1 {
		a.t.Fatalf("%d notifications, want 1", len(notifications))
	}
	if err := a.pool.QueryRow(a.t.Context(), query, notifications[0].Id.String()).Scan(&status); err != nil {
		a.t.Fatalf("read the push status: %v", err)
	}
	return status
}

func (a testAPI) deviceOwner(token string) (owner string, active bool) {
	a.t.Helper()
	const query = "SELECT o.firebase_uid, d.active FROM devices AS d JOIN owners AS o ON o.id = d.owner_id WHERE d.token = $1"
	if err := a.pool.QueryRow(a.t.Context(), query, token).Scan(&owner, &active); err != nil {
		return "", false
	}
	return owner, active
}

// newSighting registers a lost pet of Ana with one sighting: Ana gets one
// notification and one push job.
func (a testAPI) newSighting() {
	a.t.Helper()
	pet := a.createPet("token-ana", `{"name": "Rex", "species": "dog"}`)
	report := a.reportLost("token-ana", pet, `"latitude": -23.5505, "longitude": -46.6333`)
	if rec := a.publicJSON(http.MethodPost, "/v1/reports/"+report.Id.String()+"/sightings", `{}`); rec.Code != http.StatusCreated {
		a.t.Fatalf("POST sighting: status = %d", rec.Code)
	}
}

// RF-26: o sistema envia cada notificação também por push.
func TestPushOfANotification(t *testing.T) {
	testAPI := petsAPI(t)
	good, refused := "token-"+rand.Text(), "token-"+rand.Text()
	for _, token := range []string{good, refused} {
		rec := testAPI.call(http.MethodPut, "/v1/me/devices", "token-ana", `{"token": "`+token+`", "platform": "android"}`)
		if rec.Code != http.StatusNoContent {
			t.Fatalf("PUT device: status = %d, body %s", rec.Code, rec.Body)
		}
	}
	pusher := &fakePusher{invalid: []string{refused}}
	testAPI.newSighting()

	testAPI.runJobsWith(pusher)

	if len(pusher.messages) != 1 {
		t.Fatalf("%d push messages, want 1", len(pusher.messages))
	}
	sent := pusher.messages[0]
	if !slices.Contains(sent.tokens, good) || !slices.Contains(sent.tokens, refused) ||
		sent.message.Title != "Alguém viu Rex" || sent.message.Data["kind"] != alerts.KindSighting {
		t.Errorf("push = %+v, want the sighting of Rex to the two devices of Ana", sent)
	}
	if status := testAPI.pushStatus("token-ana"); status != "sent" {
		t.Errorf("push status = %q, want sent", status)
	}
	// RN-36: um token que o Cloud Messaging recusa é desativado.
	if _, active := testAPI.deviceOwner(refused); active {
		t.Error("the refused device is still active")
	}
	if _, active := testAPI.deviceOwner(good); !active {
		t.Error("the good device is not active")
	}

	// RNF-02: toda tarefa é segura para executar duas vezes.
	if _, err := testAPI.pool.Exec(t.Context(), "UPDATE jobs SET status = 'pending' WHERE kind = 'send_push' AND payload->>'notificationId' = $1",
		testAPI.notifications("token-ana")[0].Id.String()); err != nil {
		t.Fatalf("run the push job again: %v", err)
	}
	testAPI.runJobsWith(pusher)
	if len(pusher.messages) != 1 {
		t.Errorf("%d push messages after the second run, want 1", len(pusher.messages))
	}
}

// RN-36: o push só é enviado com a credencial configurada. RN-35: a
// notificação existe na lista mesmo quando o push não sai.
func TestNotificationWithNoPushCredential(t *testing.T) {
	testAPI := petsAPI(t)
	rec := testAPI.call(http.MethodPut, "/v1/me/devices", "token-ana", `{"token": "token-`+rand.Text()+`", "platform": "ios"}`)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("PUT device: status = %d", rec.Code)
	}
	testAPI.newSighting()

	testAPI.runJobsWith(nil)

	if status := testAPI.pushStatus("token-ana"); status != "not_sent" {
		t.Errorf("push status = %q, want not_sent", status)
	}
}

// RN-31: um token pertence ao tutor que fez o último registro dele. O tutor
// remove só um token dele.
func TestDeviceOwner(t *testing.T) {
	testAPI := petsAPI(t)
	token := "token-" + rand.Text()
	register := func(owner string) {
		t.Helper()
		rec := testAPI.call(http.MethodPut, "/v1/me/devices", owner, `{"token": "`+token+`", "platform": "web"}`)
		if rec.Code != http.StatusNoContent {
			t.Fatalf("PUT device by %s: status = %d", owner, rec.Code)
		}
	}
	register("token-ana")
	anaUID, _ := testAPI.deviceOwner(token)
	register("token-bia")
	biaUID, active := testAPI.deviceOwner(token)
	if biaUID == anaUID || !active {
		t.Fatalf("the token stays with %q, want the owner of the last registration", biaUID)
	}

	// Ana removes the token, which is of Bia now: nothing changes.
	removal := `{"token": "` + token + `"}`
	if rec := testAPI.call(http.MethodPost, "/v1/me/devices/removal", "token-ana", removal); rec.Code != http.StatusNoContent {
		t.Fatalf("DELETE by Ana: status = %d", rec.Code)
	}
	if owner, _ := testAPI.deviceOwner(token); owner != biaUID {
		t.Errorf("after the delete by Ana, the token is of %q, want Bia", owner)
	}
	if rec := testAPI.call(http.MethodPost, "/v1/me/devices/removal", "token-bia", removal); rec.Code != http.StatusNoContent {
		t.Fatalf("DELETE by Bia: status = %d", rec.Code)
	}
	if owner, _ := testAPI.deviceOwner(token); owner != "" {
		t.Errorf("after the delete by Bia, the token is of %q, want no owner", owner)
	}

	for _, body := range []string{`{"token": "", "platform": "android"}`, `{"token": "x", "platform": "windows"}`} {
		if rec := testAPI.call(http.MethodPut, "/v1/me/devices", "token-ana", body); rec.Code != http.StatusBadRequest {
			t.Errorf("PUT %s: status = %d, want 400", body, rec.Code)
		}
	}
}
