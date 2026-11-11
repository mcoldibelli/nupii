package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mcoldibelli/nupii/backend/internal/alerts"
	"github.com/mcoldibelli/nupii/backend/internal/biometrics"
	"github.com/mcoldibelli/nupii/backend/internal/platform/jobs"
	"github.com/mcoldibelli/nupii/backend/internal/platform/storage"
)

const (
	// _jobPurge erases the personal data older than the retention (RF-32).
	_jobPurge = "purge_expired_data"
	// RN-42: o sistema apaga o que tem mais de 30 dias.
	_retention = 30 * 24 * time.Hour
	// RN-42: todo dia às 3h, no fuso de Brasília.
	_purgeHour = 3
	_purgeZone = "America/Sao_Paulo"
)

// _brasilia is the time zone of the purge. The binary has the time zone
// data (time/tzdata in main.go), so the zone always loads.
var _brasilia = mustLoadLocation(_purgeZone)

func mustLoadLocation(name string) *time.Location {
	zone, err := time.LoadLocation(name)
	if err != nil {
		panic(fmt.Sprintf("load the time zone %s: %v", name, err))
	}
	return zone
}

// nextPurge returns the first 3h of Brasília after now (RN-42).
func nextPurge(now time.Time) time.Time {
	local := now.In(_brasilia)
	next := time.Date(local.Year(), local.Month(), local.Day(), _purgeHour, 0, 0, 0, _brasilia)
	if !next.After(local) {
		next = next.AddDate(0, 0, 1)
	}
	return next
}

// schedulePurge writes the next purge. A purge that is already written for
// that time does not repeat.
func schedulePurge(ctx context.Context, db jobs.Execer, now time.Time) error {
	return jobs.EnqueueAt(ctx, db, _jobPurge, struct{}{}, nextPurge(now))
}

// purgeHandler returns the handler of the daily purge (RF-32, RN-42). Each
// module erases its own data. A job deletes the photos after the commit.
func purgeHandler(
	pool *pgxpool.Pool,
	identifications *biometrics.Service,
	locations *alerts.Service,
	logger *slog.Logger,
) jobs.Handler {
	return func(ctx context.Context, tx pgx.Tx, _ json.RawMessage) error {
		now := time.Now()
		// RN-42: todo dia. The next purge is written outside the
		// transaction of this job, so a purge that fails does not stop
		// the next ones.
		if err := schedulePurge(ctx, pool, now); err != nil {
			return err
		}
		before := now.Add(-_retention)
		keys, err := identifications.PurgeExpired(ctx, tx, before)
		if err != nil {
			return err
		}
		if err := locations.PurgeExpired(ctx, tx, before); err != nil {
			return err
		}
		finished, err := jobs.PurgeFinished(ctx, tx, before)
		if err != nil {
			return err
		}
		if err := storage.EnqueueDelete(ctx, tx, keys); err != nil {
			return err
		}
		logger.InfoContext(ctx, "purge of expired data",
			slog.Int("photos", len(keys)), slog.Int64("jobs", finished))
		return nil
	}
}
