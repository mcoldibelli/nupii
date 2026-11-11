package health

import (
	"context"
	"errors"
	"fmt"
	"math"
	"mime/multipart"
	"net/http"
	"time"

	"github.com/oapi-codegen/runtime/types"

	"github.com/mcoldibelli/nupii/backend/internal/api"
	"github.com/mcoldibelli/nupii/backend/internal/identity"
	"github.com/mcoldibelli/nupii/backend/internal/pets"
	"github.com/mcoldibelli/nupii/backend/internal/platform/httpx"
)

// Handlers implements the health operations of the contract.
type Handlers struct {
	service *Service
}

// NewHandlers returns the handlers that use service.
func NewHandlers(service *Service) *Handlers {
	return &Handlers{service: service}
}

// classify returns the HTTP status and the body of the response for an
// error of the service. The status is 0 for an error that has no response
// in the contract.
func classify(err error) (int, api.Error) {
	var validation *ValidationError
	switch {
	case errors.As(err, &validation):
		return http.StatusBadRequest, api.Error{
			Error: api.ErrorCodeInvalidRequest, Message: validation.Message,
		}
	case errors.Is(err, ErrEventNotFound):
		return http.StatusNotFound, api.Error{
			Error: api.ErrorCodeHealthEventNotFound, Message: "the health event does not exist",
		}
	case errors.Is(err, pets.ErrPetNotFound), errors.Is(err, identity.ErrOwnerNotFound):
		// An account with no owner has no pet: the answer is the same.
		return http.StatusNotFound, api.Error{
			Error: api.ErrorCodePetNotFound, Message: "the pet does not exist for this owner",
		}
	default:
		return 0, api.Error{}
	}
}

// ListHealthEvents returns the events of a pet of the owner.
func (h *Handlers) ListHealthEvents(
	ctx context.Context,
	request api.ListHealthEventsRequestObject,
) (api.ListHealthEventsResponseObject, error) {
	events, err := h.service.List(ctx, request.PetId.String())
	if err != nil {
		if status, body := classify(err); status == http.StatusNotFound {
			return api.ListHealthEvents404JSONResponse{
				PetNotFoundJSONResponse: api.PetNotFoundJSONResponse(body),
			}, nil
		}
		return nil, fmt.Errorf("list health events: %w", err)
	}
	list := api.HealthEventList{Events: make([]api.HealthEvent, 0, len(events))}
	for _, event := range events {
		converted, err := eventToAPI(event)
		if err != nil {
			return nil, err
		}
		list.Events = append(list.Events, converted)
	}
	return api.ListHealthEvents200JSONResponse(list), nil
}

// CreateHealthEvent creates an event of a pet of the owner.
func (h *Handlers) CreateHealthEvent(
	ctx context.Context,
	request api.CreateHealthEventRequestObject,
) (api.CreateHealthEventResponseObject, error) {
	event, err := h.service.Create(ctx, request.PetId.String(), inputFromAPI(*request.Body))
	if err != nil {
		switch status, body := classify(err); status {
		case http.StatusBadRequest:
			return api.CreateHealthEvent400JSONResponse{
				InvalidRequestJSONResponse: api.InvalidRequestJSONResponse(body),
			}, nil
		case http.StatusNotFound:
			return api.CreateHealthEvent404JSONResponse{
				PetNotFoundJSONResponse: api.PetNotFoundJSONResponse(body),
			}, nil
		default:
			return nil, fmt.Errorf("create health event: %w", err)
		}
	}
	converted, err := eventToAPI(event)
	if err != nil {
		return nil, err
	}
	return api.CreateHealthEvent201JSONResponse(converted), nil
}

// UpdateHealthEvent replaces all the data of an event.
func (h *Handlers) UpdateHealthEvent(
	ctx context.Context,
	request api.UpdateHealthEventRequestObject,
) (api.UpdateHealthEventResponseObject, error) {
	event, err := h.service.Update(ctx, request.PetId.String(), request.EventId.String(),
		inputFromAPI(*request.Body))
	if err != nil {
		switch status, body := classify(err); status {
		case http.StatusBadRequest:
			return api.UpdateHealthEvent400JSONResponse{
				InvalidRequestJSONResponse: api.InvalidRequestJSONResponse(body),
			}, nil
		case http.StatusNotFound:
			return api.UpdateHealthEvent404JSONResponse{
				HealthEventNotFoundJSONResponse: api.HealthEventNotFoundJSONResponse(body),
			}, nil
		default:
			return nil, fmt.Errorf("update health event: %w", err)
		}
	}
	converted, err := eventToAPI(event)
	if err != nil {
		return nil, err
	}
	return api.UpdateHealthEvent200JSONResponse(converted), nil
}

// DeleteHealthEvent deletes an event.
func (h *Handlers) DeleteHealthEvent(
	ctx context.Context,
	request api.DeleteHealthEventRequestObject,
) (api.DeleteHealthEventResponseObject, error) {
	err := h.service.Delete(ctx, request.PetId.String(), request.EventId.String())
	if err != nil {
		if status, body := classify(err); status == http.StatusNotFound {
			return api.DeleteHealthEvent404JSONResponse{
				HealthEventNotFoundJSONResponse: api.HealthEventNotFoundJSONResponse(body),
			}, nil
		}
		return nil, fmt.Errorf("delete health event: %w", err)
	}
	return api.DeleteHealthEvent204Response{}, nil
}

// ListUpcomingCare returns the upcoming care of the pets of the owner.
func (h *Handlers) ListUpcomingCare(
	ctx context.Context,
	_ api.ListUpcomingCareRequestObject,
) (api.ListUpcomingCareResponseObject, error) {
	care, err := h.service.UpcomingCare(ctx)
	if errors.Is(err, identity.ErrOwnerNotFound) {
		return api.ListUpcomingCare404JSONResponse{
			OwnerNotFoundJSONResponse: api.OwnerNotFoundJSONResponse{
				Error: api.ErrorCodeOwnerNotFound, Message: "the account has no owner yet",
			},
		}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("list upcoming care: %w", err)
	}
	list := api.UpcomingCareList{Items: make([]api.UpcomingCare, 0, len(care))}
	for _, item := range care {
		converted := api.UpcomingCare{
			PetName: item.PetName,
			Type:    api.HealthEventType(item.Type),
			Title:   item.Title,
			DueDate: types.Date{Time: item.DueDate},
		}
		if err := converted.EventId.UnmarshalText([]byte(item.EventID)); err != nil {
			return nil, fmt.Errorf("parse the event id %q: %w", item.EventID, err)
		}
		if err := converted.PetId.UnmarshalText([]byte(item.PetID)); err != nil {
			return nil, fmt.Errorf("parse the pet id %q: %w", item.PetID, err)
		}
		list.Items = append(list.Items, converted)
	}
	return api.ListUpcomingCare200JSONResponse(list), nil
}

func dateOf(date *types.Date) *time.Time {
	if date == nil {
		return nil
	}
	return &date.Time
}

func apiDate(date *time.Time) *types.Date {
	if date == nil {
		return nil
	}
	return &types.Date{Time: *date}
}

func stringOf[T ~string](value *T) *string {
	if value == nil {
		return nil
	}
	text := string(*value)
	return &text
}

func enumOf[T ~string](value *string) *T {
	if value == nil {
		return nil
	}
	converted := T(*value)
	return &converted
}

func inputFromAPI(body api.HealthEventInput) Input {
	input := Input{
		Type: string(body.Type), Date: body.Date.Time, Notes: body.Notes, Name: body.Name,
		Vet: body.Vet, Manufacturer: body.Manufacturer, Batch: body.Batch, Dose: body.Dose,
		NextDoseDate: dateOf(body.NextDoseDate), Clinic: body.Clinic, Reason: body.Reason,
		Diagnosis: body.Diagnosis, WeightKg: body.WeightKg, ReturnDate: dateOf(body.ReturnDate),
		MedicationCategory: stringOf(body.MedicationCategory),
		ActiveIngredient:   body.ActiveIngredient, Dosage: body.Dosage, Frequency: body.Frequency,
		EndDate: dateOf(body.EndDate), InUse: body.InUse, Lab: body.Lab, Result: body.Result,
		NoteCategory: stringOf(body.NoteCategory), Title: body.Title,
		Remind: body.Remind != nil && *body.Remind,
	}
	if body.IntervalDays != nil {
		// The value outside the range of an int32 breaks RN-37 too.
		days := int32(max(min(*body.IntervalDays, math.MaxInt32), math.MinInt32))
		input.IntervalDays = &days
	}
	return input
}

func eventToAPI(event Event) (api.HealthEvent, error) {
	converted := api.HealthEvent{
		Type: api.HealthEventType(event.Type), Date: types.Date{Time: event.Date},
		Notes: event.Notes, Name: event.Name, Vet: event.Vet, Manufacturer: event.Manufacturer,
		Batch: event.Batch, Dose: event.Dose, NextDoseDate: apiDate(event.NextDoseDate),
		Clinic: event.Clinic, Reason: event.Reason, Diagnosis: event.Diagnosis,
		WeightKg: event.WeightKg, ReturnDate: apiDate(event.ReturnDate),
		MedicationCategory: enumOf[api.MedicationCategory](event.MedicationCategory),
		ActiveIngredient:   event.ActiveIngredient, Dosage: event.Dosage,
		Frequency: event.Frequency, EndDate: apiDate(event.EndDate), InUse: event.InUse,
		Lab: event.Lab, Result: event.Result,
		NoteCategory: enumOf[api.NoteCategory](event.NoteCategory), Title: event.Title,
		Remind: event.Remind, CreatedAt: event.CreatedAt,
	}
	if event.IntervalDays != nil {
		days := int(*event.IntervalDays)
		converted.IntervalDays = &days
	}
	if err := converted.Id.UnmarshalText([]byte(event.ID)); err != nil {
		return api.HealthEvent{}, fmt.Errorf("parse the id of the health event %q: %w",
			event.ID, err)
	}
	if err := converted.PetId.UnmarshalText([]byte(event.PetID)); err != nil {
		return api.HealthEvent{}, fmt.Errorf("parse the pet id of the health event %q: %w",
			event.ID, err)
	}
	return converted, nil
}

func attachmentToAPI(attachment Attachment) (api.HealthAttachment, error) {
	converted := api.HealthAttachment{
		Url:         attachment.URL,
		ContentType: api.HealthAttachmentContentType(attachment.ContentType),
		FileName:    attachment.FileName,
		SizeBytes:   int(attachment.SizeBytes),
		CreatedAt:   attachment.CreatedAt,
	}
	if err := converted.Id.UnmarshalText([]byte(attachment.ID)); err != nil {
		return api.HealthAttachment{}, fmt.Errorf("parse the id of the attachment %q: %w",
			attachment.ID, err)
	}
	return converted, nil
}

// ListHealthAttachments returns the attachments of an event.
func (h *Handlers) ListHealthAttachments(
	ctx context.Context,
	request api.ListHealthAttachmentsRequestObject,
) (api.ListHealthAttachmentsResponseObject, error) {
	petID, eventID := request.PetId.String(), request.EventId.String()
	attachments, err := h.service.Attachments(ctx, petID, eventID)
	if err != nil {
		if status, body := classify(err); status == http.StatusNotFound {
			return api.ListHealthAttachments404JSONResponse{
				HealthEventNotFoundJSONResponse: api.HealthEventNotFoundJSONResponse(body),
			}, nil
		}
		return nil, fmt.Errorf("list health attachments: %w", err)
	}
	list := api.HealthAttachmentList{
		Attachments: make([]api.HealthAttachment, 0, len(attachments)),
	}
	for _, attachment := range attachments {
		converted, err := attachmentToAPI(attachment)
		if err != nil {
			return nil, err
		}
		list.Attachments = append(list.Attachments, converted)
	}
	return api.ListHealthAttachments200JSONResponse(list), nil
}

// CreateHealthAttachment stores the part "file" of the body as an attachment.
func (h *Handlers) CreateHealthAttachment(
	ctx context.Context,
	request api.CreateHealthAttachmentRequestObject,
) (api.CreateHealthAttachmentResponseObject, error) {
	invalid := func(message string) api.CreateHealthAttachmentResponseObject {
		return api.CreateHealthAttachment400JSONResponse{
			InvalidRequestJSONResponse: api.InvalidRequestJSONResponse{
				Error: api.ErrorCodeInvalidRequest, Message: message,
			},
		}
	}
	name, data, err := readFile(request.Body)
	if err != nil {
		return invalid(err.Error()), nil
	}
	attachment, err := h.service.AddAttachment(ctx, request.PetId.String(),
		request.EventId.String(), name, data)
	if errors.Is(err, ErrAttachmentLimit) {
		return api.CreateHealthAttachment409JSONResponse{
			Error: api.ErrorCodeAttachmentLimit, Message: "the event has 10 attachments",
		}, nil
	}
	if err != nil {
		switch status, body := classify(err); status {
		case http.StatusBadRequest:
			return invalid(body.Message), nil
		case http.StatusNotFound:
			return api.CreateHealthAttachment404JSONResponse{
				HealthEventNotFoundJSONResponse: api.HealthEventNotFoundJSONResponse(body),
			}, nil
		default:
			return nil, fmt.Errorf("create health attachment: %w", err)
		}
	}
	converted, err := attachmentToAPI(attachment)
	if err != nil {
		return nil, err
	}
	return api.CreateHealthAttachment201JSONResponse(converted), nil
}

// readFile reads the part "file" of a multipart body and the name of the
// file: the field "fileName", or the name of the part. The content has at
// most one byte more than RN-82 allows, so the service tells a file that is
// too big.
func readFile(body *multipart.Reader) (string, []byte, error) {
	form, err := httpx.ReadForm(body, _maxAttachmentBytes)
	if err != nil {
		return "", nil, err
	}
	if form.File == nil {
		return "", nil, errors.New(`the body has no part "file"`)
	}
	name := form.FileName
	if field, ok := form.Fields["fileName"]; ok {
		name = field
	}
	return name, form.File, nil
}

// DeleteHealthAttachment deletes an attachment of an event.
func (h *Handlers) DeleteHealthAttachment(
	ctx context.Context,
	request api.DeleteHealthAttachmentRequestObject,
) (api.DeleteHealthAttachmentResponseObject, error) {
	err := h.service.DeleteAttachment(ctx, request.PetId.String(), request.EventId.String(),
		request.AttachmentId.String())
	if err != nil {
		if status, body := classify(err); status == http.StatusNotFound {
			return api.DeleteHealthAttachment404JSONResponse{
				HealthEventNotFoundJSONResponse: api.HealthEventNotFoundJSONResponse(body),
			}, nil
		}
		return nil, fmt.Errorf("delete health attachment: %w", err)
	}
	return api.DeleteHealthAttachment204Response{}, nil
}
