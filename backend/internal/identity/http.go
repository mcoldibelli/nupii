package identity

import (
	"context"
	"errors"
	"fmt"

	"github.com/mcoldibelli/nupii/backend/internal/api"
)

// errNoIdentity means that an operation ran without RequireIdentity. It is
// a wiring error, so the client gets the internal error.
var errNoIdentity = errors.New("identity: the request has no identity in the context")

// Handlers implements the operations of the contract for the owner.
type Handlers struct {
	service *Service
}

// NewHandlers returns the handlers that use service.
func NewHandlers(service *Service) *Handlers {
	return &Handlers{service: service}
}

// GetMe returns the owner of the account that made the request.
func (h *Handlers) GetMe(
	ctx context.Context,
	_ api.GetMeRequestObject,
) (api.GetMeResponseObject, error) {
	who, ok := FromContext(ctx)
	if !ok {
		return nil, errNoIdentity
	}
	owner, err := h.service.Owner(ctx, who)
	if errors.Is(err, ErrOwnerNotFound) {
		return api.GetMe404JSONResponse{
			Error:   api.ErrorCodeOwnerNotFound,
			Message: "the account has no owner yet",
		}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get the owner of the account: %w", err)
	}
	return api.GetMe200JSONResponse(ownerToAPI(owner)), nil
}

// RegisterMe creates the owner of the account that made the request.
func (h *Handlers) RegisterMe(
	ctx context.Context,
	request api.RegisterMeRequestObject,
) (api.RegisterMeResponseObject, error) {
	who, ok := FromContext(ctx)
	if !ok {
		return nil, errNoIdentity
	}
	owner, created, err := h.service.Register(
		ctx, who, request.Body.Name, string(request.Body.AcceptedTermsVersion))
	switch {
	case errors.Is(err, ErrInvalidName):
		return api.RegisterMe400JSONResponse{
			Error:   api.ErrorCodeInvalidRequest,
			Message: "the name is empty or has more than 100 characters",
		}, nil
	case errors.Is(err, ErrTermsVersion):
		return api.RegisterMe400JSONResponse{
			Error:   api.ErrorCodeInvalidRequest,
			Message: "acceptedTermsVersion is not the current version of the terms",
		}, nil
	case err != nil:
		return nil, fmt.Errorf("register the owner of the account: %w", err)
	case created:
		return api.RegisterMe201JSONResponse(ownerToAPI(owner)), nil
	default:
		return api.RegisterMe200JSONResponse(ownerToAPI(owner)), nil
	}
}

func ownerToAPI(owner Owner) api.Owner {
	return api.Owner{
		Id:              owner.ID,
		Name:            owner.Name,
		Email:           owner.Email,
		TermsVersion:    owner.TermsVersion,
		TermsAcceptedAt: owner.TermsAcceptedAt,
	}
}
