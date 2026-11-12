//go:build integration

package main

import (
	"bytes"
	"context"
	"log/slog"
	"maps"
	"net/http"
	"testing"
	"time"

	"github.com/mcoldibelli/nupii/backend/internal/api"
	"github.com/mcoldibelli/nupii/backend/internal/platform/jobs"
	"github.com/mcoldibelli/nupii/backend/internal/platform/storage"
)

// RN-42: todo dia às 3h o sistema apaga o que tem mais de 30 dias: o contato
// deixado por visitantes, a foto da consulta e a última localização do tutor.
func TestPurgeExpiredData(t *testing.T) {
	testAPI := petsAPI(t)
	ctx := t.Context()
	pet := testAPI.createPet("token-ana", `{"name": "Rex", "species": "dog"}`)
	if rec := testAPI.upload(http.MethodPost, "token-ana", "/v1/pets/"+pet.Id.String()+"/noseprints", nosePhoto()); rec.Code != http.StatusCreated {
		t.Fatalf("POST noseprints: status = %d", rec.Code)
	}
	var noseprintID string
	if err := testAPI.pool.QueryRow(ctx, `SELECT id FROM noseprints WHERE pet_id = $1`, pet.Id).Scan(&noseprintID); err != nil {
		t.Fatalf("read the noseprint: %v", err)
	}
	oldKey := "identifications/purge-" + time.Now().Format("150405.000000") + ".jpg"
	if err := testAPI.photos.Put(ctx, oldKey, "image/jpeg", bytes.NewReader(nosePhoto()), int64(len(nosePhoto()))); err != nil {
		t.Fatalf("store the photo of the consult: %v", err)
	}
	// Two confirmed identifications of Rex: one of 31 days and one of 29 days.
	identification := func(age int, key *string) string {
		var id string
		const insert = `INSERT INTO identifications
			(model_version, photo_key, contact_name, contact_phone, contact_message, created_at)
			VALUES ('test-model', $1, 'Visitante', '11 99999-0000', 'Achei', now() - make_interval(days => $2))
			RETURNING id`
		if err := testAPI.pool.QueryRow(ctx, insert, key, age).Scan(&id); err != nil {
			t.Fatalf("insert an identification: %v", err)
		}
		const candidate = `INSERT INTO identification_candidates
			(identification_id, noseprint_id, pet_id, rank, similarity, confirmed_at)
			VALUES ($1, $2, $3, 1, 0.9, now() - make_interval(days => $4))`
		if _, err := testAPI.pool.Exec(ctx, candidate, id, noseprintID, pet.Id, age); err != nil {
			t.Fatalf("insert a candidate: %v", err)
		}
		t.Cleanup(func() {
			// The context of the test ends before the cleanup.
			cleanup := context.WithoutCancel(ctx)
			for _, statement := range []string{
				`DELETE FROM identification_candidates WHERE identification_id = $1`,
				`DELETE FROM identifications WHERE id = $1`,
			} {
				if _, err := testAPI.pool.Exec(cleanup, statement, id); err != nil {
					t.Errorf("delete the identification: %v", err)
				}
			}
		})
		return id
	}
	old := identification(31, &oldKey)
	recentKey := "identifications/recent.jpg"
	recent := identification(29, &recentKey)
	testAPI.setLocation("token-ana", `{"latitude": -23.5505, "longitude": -46.6333}`)
	testAPI.setLocation("token-bia", `{"latitude": -23.5505, "longitude": -46.6333}`)
	anaID := testAPI.ownerID("token-ana")
	const age = `UPDATE owner_locations SET updated_at = now() - interval '31 days' WHERE owner_id = $1`
	if _, err := testAPI.pool.Exec(ctx, age, anaID); err != nil {
		t.Fatalf("age the location: %v", err)
	}

	// RN-42: o contato do visitante também fica no texto da notificação de
	// encontro e no payload das tarefas.
	insertNotification := func(age int) string {
		var id string
		const insert = `INSERT INTO notifications (owner_id, kind, source_id, title, body, created_at)
			VALUES ($1, 'found', uuidv7(), 'Encontraram o Rex', 'Visitante deixou o contato.',
				now() - make_interval(days => $2)) RETURNING id`
		if err := testAPI.pool.QueryRow(ctx, insert, anaID, age).Scan(&id); err != nil {
			t.Fatalf("insert a notification: %v", err)
		}
		return id
	}
	oldNotification, recentNotification := insertNotification(31), insertNotification(29)
	insertJob := func(age int) string {
		var id string
		const insert = `INSERT INTO jobs (kind, payload, status, updated_at)
			VALUES ('notify_found', '{"contactName": "Visitante"}', 'done', now() - make_interval(days => $1))
			RETURNING id`
		if err := testAPI.pool.QueryRow(ctx, insert, age).Scan(&id); err != nil {
			t.Fatalf("insert a job: %v", err)
		}
		return id
	}
	oldJob, recentJob := insertJob(31), insertJob(29)

	handlers := map[string]jobs.Handler{_jobPurge: testAPI.purge}
	maps.Copy(handlers, storage.JobHandlers(testAPI.photos, slog.New(slog.DiscardHandler)))
	runner := jobs.NewRunner(testAPI.pool, slog.New(slog.DiscardHandler), handlers)
	tx, err := testAPI.pool.Begin(ctx)
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	// The clock of the database can be behind the clock of the test, and the
	// runner takes only the jobs with run_at before the clock of the database.
	if err := jobs.EnqueueAt(ctx, tx, _jobPurge, struct{}{}, time.Now().Add(-time.Second)); err != nil {
		t.Fatalf("enqueue the purge: %v", err)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatalf("commit: %v", err)
	}
	// The purge, then the job that deletes the photos after its commit.
	for range 2 {
		if worked, err := runner.Work(ctx); err != nil || !worked {
			t.Fatalf("run the jobs: worked %v, error %v", worked, err)
		}
	}
	for id, want := range map[string]int{oldNotification: 0, recentNotification: 1} {
		if got := testAPI.count(`SELECT count(*) FROM notifications WHERE id = $1`, id); got != want {
			t.Errorf("notification %s: %d, want %d", id, got, want)
		}
	}
	for id, want := range map[string]int{oldJob: 0, recentJob: 1} {
		if got := testAPI.count(`SELECT count(*) FROM jobs WHERE id = $1`, id); got != want {
			t.Errorf("job %s: %d, want %d", id, got, want)
		}
	}

	var contacts, photos int
	const read = `SELECT count(contact_name) + count(contact_phone) + count(contact_message), count(photo_key)
		FROM identifications WHERE id = $1`
	for id, want := range map[string]int{old: 0, recent: 3} {
		if err := testAPI.pool.QueryRow(ctx, read, id).Scan(&contacts, &photos); err != nil {
			t.Fatalf("read the identification: %v", err)
		}
		if contacts != want || photos != want/3 {
			t.Errorf("identification %s: %d contact fields and %d photos, want %d and %d", id, contacts, photos, want, want/3)
		}
	}
	url, err := testAPI.photos.SignedURL(oldKey, time.Minute)
	if err != nil {
		t.Fatalf("sign the URL of the old photo: %v", err)
	}
	if status, _ := readURL(t, url); status != http.StatusNotFound {
		t.Errorf("read the old photo of the consult: status %d, want 404", status)
	}
	for token, want := range map[string]int{"token-ana": 0, "token-bia": 1} {
		got := testAPI.count(`SELECT count(*) FROM owner_locations WHERE owner_id = $1`, testAPI.ownerID(token))
		if got != want {
			t.Errorf("locations of %s: %d, want %d", token, got, want)
		}
	}
	// A notice with no contact leaves the list of the owner.
	rec := testAPI.call(http.MethodGet, "/v1/found-notices", "token-ana", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("GET found-notices: status = %d, body %s", rec.Code, rec.Body)
	}
	if notices := decode[api.FoundNoticeList](t, rec).Notices; len(notices) != 1 {
		t.Errorf("%d notices, want only the recent one", len(notices))
	}

	// The purge writes the next run, at 3h of Brasília, only one time.
	next := nextPurge(time.Now())
	for range 2 {
		if err := schedulePurge(ctx, testAPI.pool, time.Now()); err != nil {
			t.Fatalf("schedule the purge: %v", err)
		}
	}
	const scheduled = `SELECT count(*) FROM jobs WHERE kind = $1 AND run_at = $2 AND status = 'pending'`
	if got := testAPI.count(scheduled, _jobPurge, next); got != 1 {
		t.Errorf("%d purge jobs at %s, want 1", got, next)
	}
}
