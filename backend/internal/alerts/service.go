// Package alerts has the last location of the owners, the notifications
// and the jobs that create them.
package alerts

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mcoldibelli/nupii/backend/internal/alerts/alertsdb"
	"github.com/mcoldibelli/nupii/backend/internal/identity"
)

// ErrNotificationNotFound means that the notification does not exist for
// the owner that made the request (RN-74).
var ErrNotificationNotFound = errors.New("notification not found")

// ValidationError is the error for data that breaks a rule.
type ValidationError struct {
	Message string
}

func (e *ValidationError) Error() string {
	return e.Message
}

// Notification is a message for an owner.
type Notification struct {
	ID       string
	Kind     string
	ReportID *string
	Title    string
	Body     string
	// DistanceMeters is set in a nearby alert.
	DistanceMeters *int32
	CreatedAt      time.Time
	Read           bool
}

// OwnerFinder gives the owner that made a request. *identity.Service
// implements it.
type OwnerFinder interface {
	CurrentOwner(ctx context.Context) (identity.Owner, error)
}

// Service has the rules of the location and of the notifications.
type Service struct {
	queries *alertsdb.Queries
	owners  OwnerFinder
}

// NewService returns the service that keeps its data in the database of pool.
func NewService(pool *pgxpool.Pool, owners OwnerFinder) *Service {
	return &Service{queries: alertsdb.New(pool), owners: owners}
}

func (s *Service) ownerID(ctx context.Context) (string, error) {
	owner, err := s.owners.CurrentOwner(ctx)
	if err != nil {
		return "", fmt.Errorf("find the owner of the request: %w", err)
	}
	return owner.ID, nil
}

// SetLocation keeps the last location of the owner that made the request
// (RF-22, RN-30).
func (s *Service) SetLocation(ctx context.Context, latitude, longitude float64) error {
	// RN-75: a localização é um ponto da Terra. A value that is not a
	// number (NaN) fails each comparison.
	if !(latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180) {
		return &ValidationError{
			Message: "latitude must be from -90 to 90, and longitude from -180 to 180",
		}
	}
	ownerID, err := s.ownerID(ctx)
	if err != nil {
		return err
	}
	err = s.queries.SetOwnerLocation(ctx, alertsdb.SetOwnerLocationParams{
		OwnerID:   ownerID,
		Latitude:  latitude,
		Longitude: longitude,
	})
	if err != nil {
		return fmt.Errorf("set the location of the owner: %w", err)
	}
	return nil
}

// Notifications returns the 50 newest notifications of the owner that made
// the request (RF-25, RN-35).
func (s *Service) Notifications(ctx context.Context) ([]Notification, error) {
	ownerID, err := s.ownerID(ctx)
	if err != nil {
		return nil, err
	}
	rows, err := s.queries.ListNotifications(ctx, ownerID)
	if err != nil {
		return nil, fmt.Errorf("list notifications: %w", err)
	}
	notifications := make([]Notification, 0, len(rows))
	for _, row := range rows {
		notifications = append(notifications, Notification{
			ID:             row.ID,
			Kind:           row.Kind,
			ReportID:       row.ReportID,
			Title:          row.Title,
			Body:           row.Body,
			DistanceMeters: row.DistanceM,
			CreatedAt:      row.CreatedAt,
			Read:           row.ReadAt != nil,
		})
	}
	return notifications, nil
}

// MarkRead marks the notification id of the owner that made the request as
// read. It returns ErrNotificationNotFound for a notification of another
// owner (RN-74).
func (s *Service) MarkRead(ctx context.Context, id string) error {
	ownerID, err := s.ownerID(ctx)
	if err != nil {
		return err
	}
	rows, err := s.queries.MarkNotificationRead(ctx, alertsdb.MarkNotificationReadParams{
		ID:      id,
		OwnerID: ownerID,
	})
	if err != nil {
		return fmt.Errorf("mark the notification as read: %w", err)
	}
	if rows == 0 {
		return ErrNotificationNotFound
	}
	return nil
}

// MarkAllRead marks all the notifications of the owner that made the request
// as read (RN-74). An account with no owner has no notification.
func (s *Service) MarkAllRead(ctx context.Context) error {
	ownerID, err := s.ownerID(ctx)
	if errors.Is(err, identity.ErrOwnerNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	if err := s.queries.MarkAllNotificationsRead(ctx, ownerID); err != nil {
		return fmt.Errorf("mark all the notifications as read: %w", err)
	}
	return nil
}

// _maxTokenLength is more than the length of a token of Firebase Cloud
// Messaging.
const _maxTokenLength = 4096

// RegisterDevice registers the device token of the owner that made the
// request, for push (RF-23). A token of another owner passes to this owner
// (RN-31).
func (s *Service) RegisterDevice(ctx context.Context, token, platform string) error {
	if token == "" || len(token) > _maxTokenLength {
		return &ValidationError{Message: "token must have from 1 to 4096 characters"}
	}
	switch platform {
	case "android", "ios", "web":
	default:
		return &ValidationError{Message: "platform must be android, ios or web"}
	}
	ownerID, err := s.ownerID(ctx)
	if err != nil {
		return err
	}
	err = s.queries.SetDevice(ctx, alertsdb.SetDeviceParams{
		Token: token, OwnerID: ownerID, Platform: platform,
	})
	if err != nil {
		return fmt.Errorf("register the device: %w", err)
	}
	return nil
}

// RemoveDevice removes the device token of the owner that made the
// request. A token of another owner stays (RN-31).
func (s *Service) RemoveDevice(ctx context.Context, token string) error {
	ownerID, err := s.ownerID(ctx)
	if err != nil {
		return err
	}
	err = s.queries.RemoveDevice(ctx, alertsdb.RemoveDeviceParams{Token: token, OwnerID: ownerID})
	if err != nil {
		return fmt.Errorf("remove the device: %w", err)
	}
	return nil
}
