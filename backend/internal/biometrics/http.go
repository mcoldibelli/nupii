package biometrics

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"strconv"

	"github.com/oapi-codegen/runtime/types"

	"github.com/mcoldibelli/nupii/backend/internal/api"
	"github.com/mcoldibelli/nupii/backend/internal/identity"
	"github.com/mcoldibelli/nupii/backend/internal/pets"
	"github.com/mcoldibelli/nupii/backend/internal/platform/inference"
)

// Handlers implements the biometrics operations of the contract.
type Handlers struct {
	service *Service
	logger  *slog.Logger
}

// NewHandlers returns the handlers that use service.
func NewHandlers(service *Service, logger *slog.Logger) *Handlers {
	return &Handlers{service: service, logger: logger}
}

// classify returns the HTTP status and the body of the response for an
// error of the service. The status is 0 for an error that has no response
// in the contract: the caller returns it as an internal error.
func classify(err error) (int, api.Error) {
	var validation *ValidationError
	switch {
	case errors.As(err, &validation):
		return http.StatusBadRequest, api.Error{
			Error:   api.ErrorCodeInvalidRequest,
			Message: validation.Message,
		}
	case errors.Is(err, inference.ErrInvalidImage):
		return http.StatusBadRequest, api.Error{
			Error:   api.ErrorCodeInvalidRequest,
			Message: "the photo is not an image that can be read",
		}
	case errors.Is(err, identity.ErrOwnerNotFound):
		return http.StatusNotFound, api.Error{
			Error:   api.ErrorCodeOwnerNotFound,
			Message: "the account has no owner yet",
		}
	case errors.Is(err, pets.ErrPetNotFound):
		return http.StatusNotFound, api.Error{
			Error:   api.ErrorCodePetNotFound,
			Message: "the pet does not exist for this owner",
		}
	case errors.Is(err, ErrIdentificationNotFound):
		return http.StatusNotFound, api.Error{
			Error:   api.ErrorCodeIdentificationNotFound,
			Message: "the identification or the candidate does not exist",
		}
	case errors.Is(err, ErrNoseprintNotFound):
		return http.StatusNotFound, api.Error{
			Error:   api.ErrorCodeNoseprintNotFound,
			Message: "the pet has no noseprint",
		}
	case errors.Is(err, ErrSpeciesNotSupported):
		return http.StatusUnprocessableEntity, api.Error{
			Error:   api.ErrorCodeSpeciesNotSupported,
			Message: "only a dog has a noseprint",
		}
	case errors.Is(err, inference.ErrLowQuality):
		return http.StatusUnprocessableEntity, api.Error{
			Error:   api.ErrorCodeImageLowQuality,
			Message: "the photo is not sharp enough",
		}
	case errors.Is(err, inference.ErrFraming):
		return http.StatusUnprocessableEntity, api.Error{
			Error:   api.ErrorCodeImageFraming,
			Message: "the photo shows no nose",
		}
	case errors.Is(err, inference.ErrUnavailable):
		return http.StatusServiceUnavailable, api.Error{
			Error:   api.ErrorCodeUnavailable,
			Message: "the inference service does not respond",
		}
	default:
		return 0, api.Error{}
	}
}

// RegisterNoseprint makes a noseprint of a pet of the owner that made the
// request, from the part "file" of the body.
func (h *Handlers) RegisterNoseprint(
	ctx context.Context,
	request api.RegisterNoseprintRequestObject,
) (api.RegisterNoseprintResponseObject, error) {
	invalid := func(body api.Error) api.RegisterNoseprintResponseObject {
		return api.RegisterNoseprint400JSONResponse{
			InvalidRequestJSONResponse: api.InvalidRequestJSONResponse(body),
		}
	}
	invalidBody := func(message string) api.RegisterNoseprintResponseObject {
		return invalid(api.Error{Error: api.ErrorCodeInvalidRequest, Message: message})
	}
	for {
		part, err := request.Body.NextPart()
		if errors.Is(err, io.EOF) {
			return invalidBody(`the body has no part "file"`), nil
		}
		if err != nil {
			return invalidBody("the multipart body could not be read"), nil
		}
		if part.FormName() != "file" {
			continue
		}
		noseprint, err := h.service.Register(ctx, request.PetId.String(), part)
		if err == nil {
			converted, err := noseprintToAPI(noseprint)
			if err != nil {
				return nil, err
			}
			return api.RegisterNoseprint201JSONResponse(converted), nil
		}
		switch status, body := classify(err); status {
		case http.StatusBadRequest:
			return invalid(body), nil
		case http.StatusNotFound:
			return api.RegisterNoseprint404JSONResponse{
				PetNotFoundJSONResponse: api.PetNotFoundJSONResponse(body),
			}, nil
		case http.StatusUnprocessableEntity:
			return api.RegisterNoseprint422JSONResponse{
				NosePhotoRefusedJSONResponse: api.NosePhotoRefusedJSONResponse(body),
			}, nil
		case http.StatusServiceUnavailable:
			// The client gets no detail, so the cause goes to the log.
			h.logger.ErrorContext(ctx, "register noseprint: inference service failed",
				slog.Any("error", err))
			return api.RegisterNoseprint503JSONResponse{
				UnavailableJSONResponse: api.UnavailableJSONResponse(body),
			}, nil
		default:
			return nil, fmt.Errorf("register noseprint: %w", err)
		}
	}
}

// GetNoseprint returns the primary noseprint of a pet of the owner that
// made the request.
func (h *Handlers) GetNoseprint(
	ctx context.Context,
	request api.GetNoseprintRequestObject,
) (api.GetNoseprintResponseObject, error) {
	noseprint, err := h.service.Primary(ctx, request.PetId.String())
	if err != nil {
		if status, body := classify(err); status == http.StatusNotFound {
			return api.GetNoseprint404JSONResponse(body), nil
		}
		return nil, fmt.Errorf("get noseprint: %w", err)
	}
	converted, err := noseprintToAPI(noseprint)
	if err != nil {
		return nil, err
	}
	return api.GetNoseprint200JSONResponse(converted), nil
}

func noseprintToAPI(noseprint Noseprint) (api.Noseprint, error) {
	var id types.UUID
	if err := id.UnmarshalText([]byte(noseprint.ID)); err != nil {
		return api.Noseprint{}, fmt.Errorf("parse the id of the noseprint %q: %w", noseprint.ID, err)
	}
	return api.Noseprint{
		Id:           id,
		ImageUrl:     noseprint.ImageURL,
		Quality:      noseprint.Quality,
		ModelVersion: noseprint.ModelVersion,
		CapturedAt:   noseprint.CapturedAt,
	}, nil
}

// _maxFieldBytes is the maximum size of a text field of a multipart body.
// The longest field is the message of the contact: 500 characters (RN-63).
const _maxFieldBytes = 4 << 10

// form has the parts of a multipart body.
type form struct {
	// fields has the text of each part that is not the file.
	fields map[string]string
	// file has the content of the part "file", or nil.
	file []byte
}

// readForm reads the parts of a multipart body. It returns a
// ValidationError when the body cannot be read or a text field is too long.
// The size of the file is checked by the service.
func readForm(body *multipart.Reader) (form, error) {
	result := form{fields: make(map[string]string)}
	for {
		part, err := body.NextPart()
		if errors.Is(err, io.EOF) {
			return result, nil
		}
		if err != nil {
			return form{}, &ValidationError{Message: "the multipart body could not be read"}
		}
		limit := int64(_maxFieldBytes)
		if part.FormName() == "file" {
			limit = _maxPhotoBytes
		}
		// One byte over the limit is enough to know that the part is too big.
		data, err := io.ReadAll(io.LimitReader(part, limit+1))
		if err != nil {
			return form{}, &ValidationError{Message: "the multipart body could not be read"}
		}
		if part.FormName() == "file" {
			result.file = data
			continue
		}
		if int64(len(data)) > limit {
			return form{}, &ValidationError{Message: "the field " + part.FormName() + " is too long"}
		}
		result.fields[part.FormName()] = string(data)
	}
}

// location returns the point of the fields latitude and longitude, or nil
// when the form has none of them.
//
// RN-61: a latitude e a longitude são opcionais e vêm juntas.
func (f form) location() (*Location, error) {
	latitude, hasLatitude := f.fields["latitude"]
	longitude, hasLongitude := f.fields["longitude"]
	if !hasLatitude && !hasLongitude {
		return nil, nil
	}
	if hasLatitude != hasLongitude {
		return nil, &ValidationError{Message: "latitude and longitude must come together"}
	}
	point := &Location{}
	var err error
	if point.Latitude, err = strconv.ParseFloat(latitude, 64); err != nil {
		return nil, &ValidationError{Message: "latitude must be a number"}
	}
	if point.Longitude, err = strconv.ParseFloat(longitude, 64); err != nil {
		return nil, &ValidationError{Message: "longitude must be a number"}
	}
	return point, nil
}

// IdentifyNose searches the gallery for the nose in the part "file" of the
// body. It is a public operation.
func (h *Handlers) IdentifyNose(
	ctx context.Context,
	request api.IdentifyNoseRequestObject,
) (api.IdentifyNoseResponseObject, error) {
	identification, err := h.identify(ctx, request.Body)
	if err == nil {
		converted, err := identificationToAPI(identification)
		if err != nil {
			return nil, err
		}
		return api.IdentifyNose200JSONResponse(converted), nil
	}
	switch status, body := classify(err); status {
	case http.StatusBadRequest:
		return api.IdentifyNose400JSONResponse{
			InvalidRequestJSONResponse: api.InvalidRequestJSONResponse(body),
		}, nil
	case http.StatusUnprocessableEntity:
		return api.IdentifyNose422JSONResponse{
			NosePhotoRefusedJSONResponse: api.NosePhotoRefusedJSONResponse(body),
		}, nil
	case http.StatusServiceUnavailable:
		// The client gets no detail, so the cause goes to the log.
		h.logger.ErrorContext(ctx, "identify nose: inference service failed",
			slog.Any("error", err))
		return api.IdentifyNose503JSONResponse{
			UnavailableJSONResponse: api.UnavailableJSONResponse(body),
		}, nil
	default:
		return nil, fmt.Errorf("identify nose: %w", err)
	}
}

func (h *Handlers) identify(ctx context.Context, body *multipart.Reader) (Identification, error) {
	parts, err := readForm(body)
	if err != nil {
		return Identification{}, err
	}
	if parts.file == nil {
		return Identification{}, &ValidationError{Message: `the body has no part "file"`}
	}
	location, err := parts.location()
	if err != nil {
		return Identification{}, err
	}
	return h.service.Identify(ctx, parts.file, location)
}

// ConfirmIdentification records the candidate that the person that found a
// dog chose, with the contact for the owner. It is a public operation.
func (h *Handlers) ConfirmIdentification(
	ctx context.Context,
	request api.ConfirmIdentificationRequestObject,
) (api.ConfirmIdentificationResponseObject, error) {
	err := h.confirm(ctx, request.IdentificationId.String(), request.Body)
	if err == nil {
		return api.ConfirmIdentification204Response{}, nil
	}
	switch status, body := classify(err); status {
	case http.StatusBadRequest:
		return api.ConfirmIdentification400JSONResponse{
			InvalidRequestJSONResponse: api.InvalidRequestJSONResponse(body),
		}, nil
	case http.StatusNotFound:
		return api.ConfirmIdentification404JSONResponse(body), nil
	default:
		return nil, fmt.Errorf("confirm identification: %w", err)
	}
}

func (h *Handlers) confirm(
	ctx context.Context,
	identificationID string,
	body *multipart.Reader,
) error {
	parts, err := readForm(body)
	if err != nil {
		return err
	}
	var candidateID types.UUID
	if err := candidateID.UnmarshalText([]byte(parts.fields["candidateId"])); err != nil {
		return &ValidationError{Message: "candidateId must be the identifier of a candidate"}
	}
	contact := Contact{Name: parts.fields["name"], Phone: parts.fields["phone"]}
	if message, ok := parts.fields["message"]; ok {
		contact.Message = &message
	}
	return h.service.Confirm(ctx, identificationID, candidateID.String(), contact, parts.file)
}

// ListFoundNotices returns the confirmations of the pets of the owner that
// made the request.
func (h *Handlers) ListFoundNotices(
	ctx context.Context,
	_ api.ListFoundNoticesRequestObject,
) (api.ListFoundNoticesResponseObject, error) {
	notices, err := h.service.FoundNotices(ctx)
	if err != nil {
		if status, body := classify(err); status == http.StatusNotFound {
			return api.ListFoundNotices404JSONResponse{
				OwnerNotFoundJSONResponse: api.OwnerNotFoundJSONResponse(body),
			}, nil
		}
		return nil, fmt.Errorf("list found notices: %w", err)
	}
	list := api.FoundNoticeList{Notices: make([]api.FoundNotice, 0, len(notices))}
	for _, notice := range notices {
		converted := api.FoundNotice{
			PetName:      notice.PetName,
			ContactName:  notice.Contact.Name,
			ContactPhone: notice.Contact.Phone,
			Message:      notice.Contact.Message,
			ConfirmedAt:  notice.ConfirmedAt,
		}
		if err := converted.Id.UnmarshalText([]byte(notice.ID)); err != nil {
			return nil, fmt.Errorf("parse the id of the found notice %q: %w", notice.ID, err)
		}
		if err := converted.PetId.UnmarshalText([]byte(notice.PetID)); err != nil {
			return nil, fmt.Errorf("parse the pet id of the found notice %q: %w", notice.ID, err)
		}
		if notice.Location != nil {
			converted.Latitude = &notice.Location.Latitude
			converted.Longitude = &notice.Location.Longitude
		}
		list.Notices = append(list.Notices, converted)
	}
	return api.ListFoundNotices200JSONResponse(list), nil
}

func identificationToAPI(identification Identification) (api.Identification, error) {
	converted := api.Identification{
		Candidates: make([]api.IdentificationCandidate, 0, len(identification.Candidates)),
	}
	if err := converted.Id.UnmarshalText([]byte(identification.ID)); err != nil {
		return api.Identification{}, fmt.Errorf("parse the id of the identification %q: %w",
			identification.ID, err)
	}
	for _, found := range identification.Candidates {
		candidate := api.IdentificationCandidate{
			PetName:     found.PetName,
			PetPhotoUrl: found.PetPhotoURL,
			Similarity:  found.Similarity,
			Strong:      found.Strong,
		}
		if err := candidate.Id.UnmarshalText([]byte(found.ID)); err != nil {
			return api.Identification{}, fmt.Errorf("parse the id of the candidate %q: %w", found.ID, err)
		}
		converted.Candidates = append(converted.Candidates, candidate)
	}
	return converted, nil
}
