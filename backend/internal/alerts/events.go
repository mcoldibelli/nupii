package alerts

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"

	"github.com/jackc/pgx/v5"

	"github.com/mcoldibelli/nupii/backend/internal/alerts/alertsdb"
	"github.com/mcoldibelli/nupii/backend/internal/platform/jobs"
)

// The kinds of the jobs of this module. The other modules write them with
// the functions of this file, in their own transaction (RNF-01).
const (
	_jobLostReport = "notify_lost_report"
	_jobSighting   = "notify_sighting"
	_jobFound      = "notify_found"
	_jobPush       = "send_push"
)

const (
	// RN-32: o alerta vai para os tutores a até 3.000 m.
	_alertRadiusMeters = 3000
	// RN-33: o alerta vai para no máximo 100 tutores.
	_maxAlertedOwners = 100
)

// The kinds of notification, as the database and the contract name them.
const (
	KindLostNearby = "lost_nearby"
	KindSighting   = "sighting"
	KindFound      = "found"
)

// LostReport is a new lost report, as the alert of RF-24 needs it. The
// job has all the data: this module does not read the tables of reports.
type LostReport struct {
	ReportID string `json:"reportId"`
	// AuthorID is the owner of the pet. RN-34: o autor não recebe o alerta.
	AuthorID  string  `json:"authorId"`
	PetName   string  `json:"petName"`
	Place     *string `json:"place,omitempty"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

// Sighting is a new sighting of a lost pet (RN-73).
type Sighting struct {
	SightingID string  `json:"sightingId"`
	ReportID   string  `json:"reportId"`
	OwnerID    string  `json:"ownerId"`
	PetName    string  `json:"petName"`
	Place      *string `json:"place,omitempty"`
}

// Found is the first confirmation of a candidate of an identification
// (RN-16, RN-73).
type Found struct {
	CandidateID string `json:"candidateId"`
	OwnerID     string `json:"ownerId"`
	PetName     string `json:"petName"`
	ContactName string `json:"contactName"`
}

// EnqueueLostReport writes, in tx, the job that alerts the owners near a
// lost report (RF-24).
func EnqueueLostReport(ctx context.Context, tx pgx.Tx, report LostReport) error {
	return jobs.Enqueue(ctx, tx, _jobLostReport, report)
}

// EnqueueSighting writes, in tx, the job that notifies the owner of the pet.
func EnqueueSighting(ctx context.Context, tx pgx.Tx, sighting Sighting) error {
	return jobs.Enqueue(ctx, tx, _jobSighting, sighting)
}

// EnqueueFound writes, in tx, the job that notifies the owner of the pet.
func EnqueueFound(ctx context.Context, tx pgx.Tx, found Found) error {
	return jobs.Enqueue(ctx, tx, _jobFound, found)
}

// JobHandlers returns the job handlers of this module. pusher is nil when
// the API has no credential of Firebase Cloud Messaging (RN-36).
func JobHandlers(pusher Pusher) map[string]jobs.Handler {
	push := pushJob{pusher: pusher}
	return map[string]jobs.Handler{
		_jobLostReport: notifyLostReport,
		_jobSighting:   notifySighting,
		_jobFound:      notifyFound,
		_jobPush:       push.run,
	}
}

// notify creates a notification and, in the same transaction, the job that
// sends it by push (RF-26). It does nothing for a notification that exists.
func notify(ctx context.Context, tx pgx.Tx, params alertsdb.CreateNotificationParams) error {
	id, err := alertsdb.New(tx).CreateNotification(ctx, params)
	if errors.Is(err, pgx.ErrNoRows) {
		// A job that runs two times does not repeat the notification.
		return nil
	}
	if err != nil {
		return fmt.Errorf("create the %s notification: %w", params.Kind, err)
	}
	return jobs.Enqueue(ctx, tx, _jobPush, pushPayload{NotificationID: id})
}

const _lostNearbyTitle = "Pet desaparecido perto de você"

func lostNearbyBody(report LostReport) string {
	where := "você"
	if report.Place != nil {
		where = *report.Place
	}
	return fmt.Sprintf("%s sumiu perto de %s. Se você vir, avise pelo Nupii.",
		report.PetName, where)
}

func sightingTitle(sighting Sighting) string {
	return "Alguém viu " + sighting.PetName
}

func sightingBody(sighting Sighting) string {
	where := ""
	if sighting.Place != nil {
		where = " perto de " + *sighting.Place
	}
	return fmt.Sprintf("Uma pessoa viu %s%s. O avistamento está na ficha.",
		sighting.PetName, where)
}

func foundTitle(found Found) string {
	return "Alguém encontrou " + found.PetName
}

func foundBody(found Found) string {
	return fmt.Sprintf("%s reconheceu %s pela foto do focinho e deixou o contato. "+
		"Veja os avisos de encontro.", found.ContactName, found.PetName)
}

// notifyLostReport creates the notification of each owner near a lost
// report (RN-32 to RN-34). It is safe to run two times: a notification of
// the same event is not repeated.
func notifyLostReport(ctx context.Context, tx pgx.Tx, payload json.RawMessage) error {
	var report LostReport
	if err := json.Unmarshal(payload, &report); err != nil {
		return fmt.Errorf("decode the lost report: %w", err)
	}
	owners, err := alertsdb.New(tx).ListNearbyOwners(ctx, alertsdb.ListNearbyOwnersParams{
		Latitude:  report.Latitude,
		Longitude: report.Longitude,
		RadiusM:   _alertRadiusMeters,
		AuthorID:  report.AuthorID,
		MaxOwners: _maxAlertedOwners,
	})
	if err != nil {
		return fmt.Errorf("list the owners near the lost report: %w", err)
	}
	body := lostNearbyBody(report)
	for _, owner := range owners {
		// The distance is at most 3.000 m, so it fits an int32.
		distance := int32(math.Round(owner.DistanceM))
		err := notify(ctx, tx, alertsdb.CreateNotificationParams{
			OwnerID:   owner.OwnerID,
			Kind:      KindLostNearby,
			SourceID:  report.ReportID,
			ReportID:  &report.ReportID,
			Title:     _lostNearbyTitle,
			Body:      body,
			DistanceM: &distance,
		})
		if err != nil {
			return err
		}
	}
	return nil
}

func notifySighting(ctx context.Context, tx pgx.Tx, payload json.RawMessage) error {
	var sighting Sighting
	if err := json.Unmarshal(payload, &sighting); err != nil {
		return fmt.Errorf("decode the sighting: %w", err)
	}
	return notify(ctx, tx, alertsdb.CreateNotificationParams{
		OwnerID:  sighting.OwnerID,
		Kind:     KindSighting,
		SourceID: sighting.SightingID,
		ReportID: &sighting.ReportID,
		Title:    sightingTitle(sighting),
		Body:     sightingBody(sighting),
	})
}

func notifyFound(ctx context.Context, tx pgx.Tx, payload json.RawMessage) error {
	var found Found
	if err := json.Unmarshal(payload, &found); err != nil {
		return fmt.Errorf("decode the found pet: %w", err)
	}
	return notify(ctx, tx, alertsdb.CreateNotificationParams{
		OwnerID:  found.OwnerID,
		Kind:     KindFound,
		SourceID: found.CandidateID,
		Title:    foundTitle(found),
		Body:     foundBody(found),
	})
}
