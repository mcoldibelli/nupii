// Package reports has the reports of lost and found pets, the sightings and
// the public board.
package reports

import (
	"bytes"
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mcoldibelli/nupii/backend/internal/alerts"
	"github.com/mcoldibelli/nupii/backend/internal/identity"
	"github.com/mcoldibelli/nupii/backend/internal/pets"
	"github.com/mcoldibelli/nupii/backend/internal/platform/imagefile"
	"github.com/mcoldibelli/nupii/backend/internal/reports/reportsdb"
)

const (
	// RN-24: o mural mostra 20 ocorrências por página.
	_pageSize = 20
	// _maxPage keeps the offset of the query in the range of an int32.
	_maxPage = 100_000
	// RN-06: a URL temporária de uma foto vale por 15 minutos.
	_photoURLExpiry = 15 * time.Minute
	// RN-27: a foto do achado tem até 8 MB, como a foto do focinho (RN-59).
	_maxPhotoBytes = 8 << 20
	// _openLostConstraint is the unique index of RN-68.
	_openLostConstraint = "reports_open_lost_pet_key"
	// _uniqueViolation is the SQLSTATE of a unique constraint violation.
	_uniqueViolation = "23505"
)

var (
	// ErrReportNotFound means that the report does not exist, or that it
	// is not a report of the caller.
	ErrReportNotFound = errors.New("report not found")
	// ErrLostReportOpen means that the pet already has an open lost report
	// (RN-68).
	ErrLostReportOpen = errors.New("the pet already has an open lost report")
	// ErrReportNotOpen means that the report is not an open lost report
	// (RN-28).
	ErrReportNotOpen = errors.New("the report is not an open lost report")
)

// Type and status of a report, as the database keeps them.
const (
	TypeLost       = "lost"
	TypeFound      = "found"
	StatusOpen     = "open"
	StatusResolved = "resolved"
)

// Report is a report as the board and the detail show it. It has no data
// of the author (RN-72).
type Report struct {
	ID     string
	Type   string
	Status string
	// PetID, PetName and PetSpecies are set for a lost report.
	PetID           *string
	PetName         *string
	PetSpecies      *string
	PetHasNoseprint bool
	// PhotoURL is a temporary URL of the profile photo of the pet, or of the
	// photo of the nose of a found report. It is nil when there is none.
	PhotoURL   *string
	Point      Point
	Details    Details
	OccurredAt time.Time
	CreatedAt  time.Time
	// Sightings are set only in the detail of a lost report.
	Sightings []Sighting
}

// Sighting is a sighting of a lost pet. It has no data of the person that
// saw the pet (RN-72).
type Sighting struct {
	ID        string
	Point     Point
	Details   Details
	CreatedAt time.Time
}

// Board is one page of the board, with the counts of RN-24.
type Board struct {
	Reports   []Report
	Page      int
	HasNext   bool
	OpenLost  int64
	OpenFound int64
}

// LostInput is the data of a new lost report.
type LostInput struct {
	PetID      string
	Point      Point
	Details    Details
	OccurredAt *time.Time
}

// OwnerFinder gives the owner that made a request. *identity.Service
// implements it.
type OwnerFinder interface {
	CurrentOwner(ctx context.Context) (identity.Owner, error)
}

// PetFinder gives a pet of the owner that made the request.
// *pets.Service implements it. Get returns pets.ErrPetNotFound when the
// pet does not exist for that owner.
type PetFinder interface {
	Get(ctx context.Context, id string) (pets.Pet, error)
}

// PhotoStore keeps the photos. *storage.Store implements it.
type PhotoStore interface {
	Put(ctx context.Context, key, contentType string, body io.Reader, size int64) error
	Delete(ctx context.Context, key string) error
	SignedURL(key string, expires time.Duration) (string, error)
}

// Service has the rules of the reports.
type Service struct {
	pool    *pgxpool.Pool
	queries *reportsdb.Queries
	owners  OwnerFinder
	pets    PetFinder
	photos  PhotoStore
	logger  *slog.Logger
	now     func() time.Time
}

// NewService returns the service that keeps the reports in the database of
// pool and the photos in photos.
func NewService(
	pool *pgxpool.Pool,
	owners OwnerFinder,
	petFinder PetFinder,
	photos PhotoStore,
	logger *slog.Logger,
) *Service {
	return &Service{
		pool:    pool,
		queries: reportsdb.New(pool),
		owners:  owners,
		pets:    petFinder,
		photos:  photos,
		logger:  logger,
		now:     time.Now,
	}
}

// Board returns the page page of the board, from 1 (RF-16, RN-24).
func (s *Service) Board(ctx context.Context, page int) (Board, error) {
	if page < 1 || page > _maxPage {
		return Board{}, &ValidationError{Message: "page must be from 1 to 100000"}
	}
	// One row more than the page tells if there is a next page.
	rows, err := s.queries.ListBoard(ctx, reportsdb.ListBoardParams{
		PageSize: _pageSize + 1,
		// The check of page keeps the value in the range of an int32.
		Skip: int32((page - 1) * _pageSize),
	})
	if err != nil {
		return Board{}, fmt.Errorf("list the board: %w", err)
	}
	counts, err := s.queries.CountBoard(ctx)
	if err != nil {
		return Board{}, fmt.Errorf("count the board: %w", err)
	}
	board := Board{
		Page:      page,
		HasNext:   len(rows) > _pageSize,
		OpenLost:  counts.OpenLost,
		OpenFound: counts.OpenFound,
	}
	if board.HasNext {
		rows = rows[:_pageSize]
	}
	if board.Reports, err = s.reports(rows); err != nil {
		return Board{}, err
	}
	return board, nil
}

// Get returns the report id, with the sightings of a lost report (RF-17,
// RN-25). It returns ErrReportNotFound when the report does not exist.
func (s *Service) Get(ctx context.Context, id string) (Report, error) {
	row, err := s.queries.GetReport(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return Report{}, ErrReportNotFound
	}
	if err != nil {
		return Report{}, fmt.Errorf("get report: %w", err)
	}
	report, err := s.report(row)
	if err != nil {
		return Report{}, err
	}
	if report.Type != TypeLost {
		return report, nil
	}
	sightings, err := s.queries.ListSightings(ctx, id)
	if err != nil {
		return Report{}, fmt.Errorf("list sightings: %w", err)
	}
	for _, sighting := range sightings {
		report.Sightings = append(report.Sightings, Sighting{
			ID:        sighting.ID,
			Point:     Point{Latitude: sighting.Latitude, Longitude: sighting.Longitude},
			Details:   Details{Place: sighting.Place, Description: sighting.Description},
			CreatedAt: sighting.CreatedAt,
		})
	}
	return report, nil
}

// ReportLost registers that a pet of the owner that made the request is
// lost (RF-18). It returns pets.ErrPetNotFound when the pet is not of the
// owner (RN-26), and ErrLostReportOpen when the pet has an open lost report
// (RN-68).
func (s *Service) ReportLost(ctx context.Context, input LostInput) (Report, error) {
	if !input.Point.valid() {
		return Report{}, invalidPoint()
	}
	details, err := input.Details.clean()
	if err != nil {
		return Report{}, err
	}
	occurred, err := occurredAt(input.OccurredAt, s.now())
	if err != nil {
		return Report{}, err
	}
	owner, err := s.owners.CurrentOwner(ctx)
	if err != nil {
		return Report{}, fmt.Errorf("find the owner of the request: %w", err)
	}
	// RN-26: só o tutor do pet registra o desaparecimento dele.
	pet, err := s.pets.Get(ctx, input.PetID)
	if err != nil {
		return Report{}, fmt.Errorf("get the pet of the report: %w", err)
	}
	var id string
	err = s.inTx(ctx, func(tx pgx.Tx) error {
		id, err = s.queries.WithTx(tx).CreateLostReport(ctx, reportsdb.CreateLostReportParams{
			OwnerID:     &owner.ID,
			PetID:       &input.PetID,
			Latitude:    input.Point.Latitude,
			Longitude:   input.Point.Longitude,
			Place:       details.Place,
			Description: details.Description,
			OccurredAt:  occurred,
		})
		if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok &&
			pgErr.Code == _uniqueViolation && pgErr.ConstraintName == _openLostConstraint {
			return ErrLostReportOpen
		}
		if err != nil {
			return fmt.Errorf("create lost report: %w", err)
		}
		// RNF-01: a tarefa do alerta é gravada na mesma transação da ocorrência.
		return alerts.EnqueueLostReport(ctx, tx, alerts.LostReport{
			ReportID:  id,
			AuthorID:  owner.ID,
			PetName:   pet.Name,
			Place:     details.Place,
			Latitude:  input.Point.Latitude,
			Longitude: input.Point.Longitude,
		})
	})
	if err != nil {
		return Report{}, err
	}
	report, err := s.Get(ctx, id)
	if err != nil {
		return Report{}, fmt.Errorf("read the new lost report: %w", err)
	}
	return report, nil
}

// ReportFound publishes a found dog, with the photo of its nose (RF-19,
// RN-27). It returns the report and the code that resolves it (RN-69).
func (s *Service) ReportFound(
	ctx context.Context,
	photo []byte,
	point Point,
	details Details,
) (report Report, code string, err error) {
	if !point.valid() {
		return Report{}, "", invalidPoint()
	}
	if details, err = details.clean(); err != nil {
		return Report{}, "", err
	}
	if len(photo) > _maxPhotoBytes {
		return Report{}, "", &ValidationError{Message: "the photo must have at most 8 MB"}
	}
	contentType, extension, ok := imagefile.Type(photo)
	if !ok {
		return Report{}, "", &ValidationError{
			Message: "the photo must be a JPEG, PNG or WebP image",
		}
	}
	code, hash, err := newResolveCode()
	if err != nil {
		return Report{}, "", err
	}

	key := "reports/" + strings.ToLower(rand.Text()) + "." + extension
	err = s.photos.Put(ctx, key, contentType, bytes.NewReader(photo), int64(len(photo)))
	if err != nil {
		return Report{}, "", fmt.Errorf("store the photo of the found report: %w", err)
	}
	row, err := s.queries.CreateFoundReport(ctx, reportsdb.CreateFoundReportParams{
		PhotoKey:        &key,
		ResolveCodeHash: hash,
		Latitude:        point.Latitude,
		Longitude:       point.Longitude,
		Place:           details.Place,
		Description:     details.Description,
	})
	if err != nil {
		// No report points to the object. The delete continues when the
		// client ends the request.
		if derr := s.photos.Delete(context.WithoutCancel(ctx), key); derr != nil {
			s.logger.ErrorContext(ctx, "delete the photo of a found report that was not created",
				slog.String("key", key), slog.Any("error", derr))
		}
		return Report{}, "", fmt.Errorf("create found report: %w", err)
	}
	// The answer comes from the data of the insert. A read after the write
	// could fail, and the code would not reach the client (RN-69).
	report = Report{
		ID:         row.ID,
		Type:       TypeFound,
		Status:     StatusOpen,
		Point:      point,
		Details:    details,
		OccurredAt: row.OccurredAt,
		CreatedAt:  row.CreatedAt,
	}
	url, err := s.photos.SignedURL(key, _photoURLExpiry)
	if err != nil {
		// The report exists: the client still gets the code, with no photo.
		s.logger.ErrorContext(ctx, "sign the URL of a new found report",
			slog.String("report_id", row.ID), slog.Any("error", err))
		return report, code, nil
	}
	report.PhotoURL = &url
	return report, code, nil
}

// AddSighting registers that someone saw the pet of the lost report
// reportID (RF-20). point is nil when the person does not give it: the
// sighting gets the point of the lost report (RN-28). It returns
// ErrReportNotFound when the report does not exist, and ErrReportNotOpen
// when it is not an open lost report.
func (s *Service) AddSighting(
	ctx context.Context,
	reportID string,
	point *Point,
	details Details,
) (Sighting, error) {
	if point != nil && !point.valid() {
		return Sighting{}, invalidPoint()
	}
	details, err := details.clean()
	if err != nil {
		return Sighting{}, err
	}
	var sighting Sighting
	err = s.inTx(ctx, func(tx pgx.Tx) error {
		queries := s.queries.WithTx(tx)
		report, err := queries.LockOpenLostReport(ctx, reportID)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrReportNotFound
		}
		if err != nil {
			return fmt.Errorf("lock the report of the sighting: %w", err)
		}
		// RN-28: um avistamento só entra em um desaparecimento aberto.
		if report.Type != TypeLost || report.Status != StatusOpen {
			return ErrReportNotOpen
		}
		// RN-28: sem coordenadas, vale o ponto do desaparecimento.
		at := Point{Latitude: report.Latitude, Longitude: report.Longitude}
		if point != nil {
			at = *point
		}
		row, err := queries.CreateSighting(ctx, reportsdb.CreateSightingParams{
			ReportID:    reportID,
			Latitude:    at.Latitude,
			Longitude:   at.Longitude,
			Place:       details.Place,
			Description: details.Description,
		})
		if err != nil {
			return fmt.Errorf("create sighting: %w", err)
		}
		sighting = Sighting{
			ID:        row.ID,
			Point:     Point{Latitude: row.Latitude, Longitude: row.Longitude},
			Details:   Details{Place: row.Place, Description: row.Description},
			CreatedAt: row.CreatedAt,
		}
		// RN-73: um avistamento cria uma notificação para o tutor do pet.
		// An open lost report always has an owner and a pet.
		if report.OwnerID == nil || report.PetName == nil {
			return fmt.Errorf("lost report %s has no owner or no pet", reportID)
		}
		return alerts.EnqueueSighting(ctx, tx, alerts.Sighting{
			SightingID: row.ID,
			ReportID:   reportID,
			OwnerID:    *report.OwnerID,
			PetName:    *report.PetName,
			Place:      details.Place,
		})
	})
	return sighting, err
}

// Resolve resolves the report id of the owner that made the request
// (RF-21). It returns ErrReportNotFound when the report is not of the owner
// (RN-29).
func (s *Service) Resolve(ctx context.Context, id string) (Report, error) {
	owner, err := s.owners.CurrentOwner(ctx)
	if err != nil {
		return Report{}, fmt.Errorf("find the owner of the request: %w", err)
	}
	rows, err := s.queries.ResolveOwnReport(ctx, reportsdb.ResolveOwnReportParams{
		ID:      id,
		OwnerID: &owner.ID,
	})
	if err != nil {
		return Report{}, fmt.Errorf("resolve report: %w", err)
	}
	if rows == 0 {
		return Report{}, ErrReportNotFound
	}
	report, err := s.Get(ctx, id)
	if err != nil {
		return Report{}, fmt.Errorf("read the resolved report: %w", err)
	}
	return report, nil
}

// ResolveWithCode resolves the found report id with the code of its
// creation (RN-69). It returns ErrReportNotFound when the report does not
// exist or the code is wrong.
func (s *Service) ResolveWithCode(ctx context.Context, id, code string) (Report, error) {
	rows, err := s.queries.ResolveFoundReport(ctx, reportsdb.ResolveFoundReportParams{
		ID:              id,
		ResolveCodeHash: hashCode(code),
	})
	if err != nil {
		return Report{}, fmt.Errorf("resolve found report: %w", err)
	}
	if rows == 0 {
		return Report{}, ErrReportNotFound
	}
	report, err := s.Get(ctx, id)
	if err != nil {
		return Report{}, fmt.Errorf("read the resolved found report: %w", err)
	}
	return report, nil
}

// Mine returns the reports of the owner that made the request, open and
// resolved, from the newest to the oldest.
func (s *Service) Mine(ctx context.Context) ([]Report, error) {
	owner, err := s.owners.CurrentOwner(ctx)
	if err != nil {
		return nil, fmt.Errorf("find the owner of the request: %w", err)
	}
	rows, err := s.queries.ListOwnerReports(ctx, &owner.ID)
	if err != nil {
		return nil, fmt.Errorf("list the reports of the owner: %w", err)
	}
	return s.reports(rows)
}

func (s *Service) reports(rows []reportsdb.ReportView) ([]Report, error) {
	reports := make([]Report, 0, len(rows))
	for _, row := range rows {
		report, err := s.report(row)
		if err != nil {
			return nil, err
		}
		reports = append(reports, report)
	}
	return reports, nil
}

func (s *Service) report(row reportsdb.ReportView) (Report, error) {
	report := Report{
		ID:              row.ID,
		Type:            row.Type,
		Status:          row.Status,
		PetID:           row.PetID,
		PetName:         row.PetName,
		PetSpecies:      row.PetSpecies,
		PetHasNoseprint: row.PetHasNoseprint,
		Point:           Point{Latitude: row.Latitude, Longitude: row.Longitude},
		Details:         Details{Place: row.Place, Description: row.Description},
		OccurredAt:      row.OccurredAt,
		CreatedAt:       row.CreatedAt,
	}
	if row.PhotoKey != nil {
		url, err := s.photos.SignedURL(*row.PhotoKey, _photoURLExpiry)
		if err != nil {
			return Report{}, fmt.Errorf("sign the URL of the report photo: %w", err)
		}
		report.PhotoURL = &url
	}
	return report, nil
}

// inTx runs work in a transaction, and commits when work returns nil.
func (s *Service) inTx(ctx context.Context, work func(tx pgx.Tx) error) (err error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin the report transaction: %w", err)
	}
	defer func() {
		// After Commit, Rollback returns pgx.ErrTxClosed and does nothing.
		rerr := tx.Rollback(context.WithoutCancel(ctx))
		if rerr != nil && !errors.Is(rerr, pgx.ErrTxClosed) && err == nil {
			err = fmt.Errorf("roll back the report transaction: %w", rerr)
		}
	}()
	if err := work(tx); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit the report transaction: %w", err)
	}
	return nil
}

func invalidPoint() error {
	return &ValidationError{
		Message: "latitude must be from -90 to 90, and longitude from -180 to 180",
	}
}
