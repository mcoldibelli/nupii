package biometrics

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"

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
