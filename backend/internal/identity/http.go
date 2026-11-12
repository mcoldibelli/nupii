package identity

import (
	"context"
	"errors"
	"fmt"

	"github.com/mcoldibelli/nupii/backend/internal/api"
)

// Handlers implements the operations of the contract for the owner.
type Handlers struct {
	service  *Service
	accounts *Accounts
}

// NewHandlers returns the handlers that use service and accounts.
func NewHandlers(service *Service, accounts *Accounts) *Handlers {
	return &Handlers{service: service, accounts: accounts}
}

// UpdateMe changes the name of the owner of the account (RF-06).
func (h *Handlers) UpdateMe(
	ctx context.Context,
	request api.UpdateMeRequestObject,
) (api.UpdateMeResponseObject, error) {
	who, ok := FromContext(ctx)
	if !ok {
		return nil, ErrNoIdentity
	}
	owner, err := h.service.UpdateName(ctx, who, request.Body.Name)
	switch {
	case errors.Is(err, ErrInvalidName):
		return api.UpdateMe400JSONResponse{
			InvalidRequestJSONResponse: api.InvalidRequestJSONResponse{
				Error:   api.ErrorCodeInvalidRequest,
				Message: "the name is empty or has more than 100 characters",
			},
		}, nil
	case errors.Is(err, ErrOwnerNotFound):
		return api.UpdateMe404JSONResponse{
			OwnerNotFoundJSONResponse: api.OwnerNotFoundJSONResponse{
				Error: api.ErrorCodeOwnerNotFound, Message: "the account has no owner yet",
			},
		}, nil
	case err != nil:
		return nil, fmt.Errorf("update the owner of the account: %w", err)
	}
	return api.UpdateMe200JSONResponse(ownerToAPI(owner)), nil
}

// DeleteMe deletes the account that made the request (RF-08).
func (h *Handlers) DeleteMe(
	ctx context.Context,
	_ api.DeleteMeRequestObject,
) (api.DeleteMeResponseObject, error) {
	err := h.accounts.Delete(ctx)
	if errors.Is(err, ErrOwnerNotFound) {
		return api.DeleteMe404JSONResponse{
			OwnerNotFoundJSONResponse: api.OwnerNotFoundJSONResponse{
				Error: api.ErrorCodeOwnerNotFound, Message: "the account has no owner yet",
			},
		}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("delete the account: %w", err)
	}
	return api.DeleteMe204Response{}, nil
}

// GetMe returns the owner of the account that made the request.
func (h *Handlers) GetMe(
	ctx context.Context,
	_ api.GetMeRequestObject,
) (api.GetMeResponseObject, error) {
	who, ok := FromContext(ctx)
	if !ok {
		return nil, ErrNoIdentity
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
		return nil, ErrNoIdentity
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
