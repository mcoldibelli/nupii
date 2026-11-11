package alerts

import (
	"context"
	"errors"
	"fmt"

	"github.com/oapi-codegen/runtime/types"

	"github.com/mcoldibelli/nupii/backend/internal/api"
	"github.com/mcoldibelli/nupii/backend/internal/identity"
)

// Handlers implements the alert operations of the contract.
type Handlers struct {
	service *Service
}

// NewHandlers returns the handlers that use service.
func NewHandlers(service *Service) *Handlers {
	return &Handlers{service: service}
}

var _ownerNotFound = api.OwnerNotFoundJSONResponse{
	Error:   api.ErrorCodeOwnerNotFound,
	Message: "the account has no owner yet",
}

// SetMyLocation keeps the last location of the owner that made the request.
func (h *Handlers) SetMyLocation(
	ctx context.Context,
	request api.SetMyLocationRequestObject,
) (api.SetMyLocationResponseObject, error) {
	err := h.service.SetLocation(ctx, request.Body.Latitude, request.Body.Longitude)
	var validation *ValidationError
	switch {
	case err == nil:
		return api.SetMyLocation204Response{}, nil
	case errors.As(err, &validation):
		return api.SetMyLocation400JSONResponse{
			InvalidRequestJSONResponse: api.InvalidRequestJSONResponse{
				Error: api.ErrorCodeInvalidRequest, Message: validation.Message,
			},
		}, nil
	case errors.Is(err, identity.ErrOwnerNotFound):
		return api.SetMyLocation404JSONResponse{OwnerNotFoundJSONResponse: _ownerNotFound}, nil
	default:
		return nil, fmt.Errorf("set my location: %w", err)
	}
}

// ListNotifications returns the notifications of the owner that made the
// request.
func (h *Handlers) ListNotifications(
	ctx context.Context,
	_ api.ListNotificationsRequestObject,
) (api.ListNotificationsResponseObject, error) {
	notifications, err := h.service.Notifications(ctx)
	if errors.Is(err, identity.ErrOwnerNotFound) {
		return api.ListNotifications404JSONResponse{OwnerNotFoundJSONResponse: _ownerNotFound}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("list notifications: %w", err)
	}
	list := api.NotificationList{Notifications: make([]api.Notification, 0, len(notifications))}
	for _, notification := range notifications {
		converted := api.Notification{
			Kind:      api.NotificationKind(notification.Kind),
			Title:     notification.Title,
			Body:      notification.Body,
			CreatedAt: notification.CreatedAt,
			Read:      notification.Read,
		}
		if err := converted.Id.UnmarshalText([]byte(notification.ID)); err != nil {
			return nil, fmt.Errorf("parse the id of the notification %q: %w", notification.ID, err)
		}
		if notification.ReportID != nil {
			var reportID types.UUID
			if err := reportID.UnmarshalText([]byte(*notification.ReportID)); err != nil {
				return nil, fmt.Errorf("parse the report id of the notification %q: %w",
					notification.ID, err)
			}
			converted.ReportId = &reportID
		}
		if notification.DistanceMeters != nil {
			distance := int(*notification.DistanceMeters)
			converted.DistanceMeters = &distance
		}
		list.Notifications = append(list.Notifications, converted)
	}
	return api.ListNotifications200JSONResponse(list), nil
}

// MarkNotificationRead marks a notification of the owner that made the
// request as read.
func (h *Handlers) MarkNotificationRead(
	ctx context.Context,
	request api.MarkNotificationReadRequestObject,
) (api.MarkNotificationReadResponseObject, error) {
	err := h.service.MarkRead(ctx, request.NotificationId.String())
	switch {
	case err == nil:
		return api.MarkNotificationRead204Response{}, nil
	case errors.Is(err, ErrNotificationNotFound), errors.Is(err, identity.ErrOwnerNotFound):
		// An account with no owner has no notification: the answer is the same.
		return api.MarkNotificationRead404JSONResponse{
			Error:   api.ErrorCodeNotificationNotFound,
			Message: "the notification does not exist for this owner",
		}, nil
	default:
		return nil, fmt.Errorf("mark notification read: %w", err)
	}
}

// RegisterDevice registers a device of the owner that made the request.
func (h *Handlers) RegisterDevice(
	ctx context.Context,
	request api.RegisterDeviceRequestObject,
) (api.RegisterDeviceResponseObject, error) {
	err := h.service.RegisterDevice(ctx, request.Body.Token, string(request.Body.Platform))
	var validation *ValidationError
	switch {
	case err == nil:
		return api.RegisterDevice204Response{}, nil
	case errors.As(err, &validation):
		return api.RegisterDevice400JSONResponse{
			InvalidRequestJSONResponse: api.InvalidRequestJSONResponse{
				Error: api.ErrorCodeInvalidRequest, Message: validation.Message,
			},
		}, nil
	case errors.Is(err, identity.ErrOwnerNotFound):
		return api.RegisterDevice404JSONResponse{OwnerNotFoundJSONResponse: _ownerNotFound}, nil
	default:
		return nil, fmt.Errorf("register device: %w", err)
	}
}

// RemoveDevice removes a device of the owner that made the request.
func (h *Handlers) RemoveDevice(
	ctx context.Context,
	request api.RemoveDeviceRequestObject,
) (api.RemoveDeviceResponseObject, error) {
	err := h.service.RemoveDevice(ctx, request.Token)
	switch {
	case err == nil:
		return api.RemoveDevice204Response{}, nil
	case errors.Is(err, identity.ErrOwnerNotFound):
		return api.RemoveDevice404JSONResponse{OwnerNotFoundJSONResponse: _ownerNotFound}, nil
	default:
		return nil, fmt.Errorf("remove device: %w", err)
	}
}
