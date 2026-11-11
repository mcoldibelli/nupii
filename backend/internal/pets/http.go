package pets

import (
	"context"
	"errors"
	"fmt"
	"io"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/mcoldibelli/nupii/backend/internal/api"
	"github.com/mcoldibelli/nupii/backend/internal/identity"
)

// errNoIdentity means that an operation ran without the identity check. It
// is a wiring error, so the client gets the internal error.
var errNoIdentity = errors.New("pets: the request has no identity in the context")

// Handlers implements the operations of the contract for the pets.
type Handlers struct {
	service *Service
}

// NewHandlers returns the handlers that use service.
func NewHandlers(service *Service) *Handlers {
	return &Handlers{service: service}
}

// failure says how an error of the service goes to the client.
type failure int

const (
	failureInternal failure = iota + 1
	failureInvalid
	failureOwnerNotFound
	failurePetNotFound
)

// classify returns the kind of the error and the body of the response for
// the kinds that have one.
func classify(err error) (failure, api.Error) {
	var validation *ValidationError
	switch {
	case errors.As(err, &validation):
		return failureInvalid, api.Error{Error: api.ErrorCodeInvalidRequest, Message: validation.Message}
	case errors.Is(err, identity.ErrOwnerNotFound):
		return failureOwnerNotFound, api.Error{
			Error:   api.ErrorCodeOwnerNotFound,
			Message: "the account has no owner yet",
		}
	case errors.Is(err, ErrPetNotFound):
		return failurePetNotFound, api.Error{
			Error:   api.ErrorCodePetNotFound,
			Message: "the pet does not exist for this owner",
		}
	default:
		return failureInternal, api.Error{}
	}
}

// ListPets returns the pets of the owner that made the request.
func (h *Handlers) ListPets(
	ctx context.Context,
	_ api.ListPetsRequestObject,
) (api.ListPetsResponseObject, error) {
	who, ok := identity.FromContext(ctx)
	if !ok {
		return nil, errNoIdentity
	}
	pets, err := h.service.List(ctx, who)
	if err != nil {
		if kind, body := classify(err); kind == failureOwnerNotFound {
			return api.ListPets404JSONResponse{OwnerNotFoundJSONResponse: api.OwnerNotFoundJSONResponse(body)}, nil
		}
		return nil, fmt.Errorf("list pets: %w", err)
	}
	list := api.PetList{Pets: make([]api.Pet, 0, len(pets))}
	for _, pet := range pets {
		converted, err := petToAPI(pet)
		if err != nil {
			return nil, err
		}
		list.Pets = append(list.Pets, converted)
	}
	return api.ListPets200JSONResponse(list), nil
}

// CreatePet creates a pet of the owner that made the request.
func (h *Handlers) CreatePet(
	ctx context.Context,
	request api.CreatePetRequestObject,
) (api.CreatePetResponseObject, error) {
	who, ok := identity.FromContext(ctx)
	if !ok {
		return nil, errNoIdentity
	}
	pet, err := h.service.Create(ctx, who, inputFromAPI(*request.Body))
	if err != nil {
		switch kind, body := classify(err); kind {
		case failureInvalid:
			return api.CreatePet400JSONResponse{InvalidRequestJSONResponse: api.InvalidRequestJSONResponse(body)}, nil
		case failureOwnerNotFound:
			return api.CreatePet404JSONResponse{OwnerNotFoundJSONResponse: api.OwnerNotFoundJSONResponse(body)}, nil
		default:
			return nil, fmt.Errorf("create pet: %w", err)
		}
	}
	converted, err := petToAPI(pet)
	if err != nil {
		return nil, err
	}
	return api.CreatePet201JSONResponse(converted), nil
}

// GetPet returns a pet of the owner that made the request.
func (h *Handlers) GetPet(
	ctx context.Context,
	request api.GetPetRequestObject,
) (api.GetPetResponseObject, error) {
	who, ok := identity.FromContext(ctx)
	if !ok {
		return nil, errNoIdentity
	}
	pet, err := h.service.Get(ctx, who, request.PetId.String())
	if err != nil {
		switch kind, body := classify(err); kind {
		case failureOwnerNotFound, failurePetNotFound:
			return api.GetPet404JSONResponse{PetNotFoundJSONResponse: api.PetNotFoundJSONResponse(body)}, nil
		default:
			return nil, fmt.Errorf("get pet: %w", err)
		}
	}
	converted, err := petToAPI(pet)
	if err != nil {
		return nil, err
	}
	return api.GetPet200JSONResponse(converted), nil
}

// UpdatePet replaces the data of a pet of the owner that made the request.
func (h *Handlers) UpdatePet(
	ctx context.Context,
	request api.UpdatePetRequestObject,
) (api.UpdatePetResponseObject, error) {
	who, ok := identity.FromContext(ctx)
	if !ok {
		return nil, errNoIdentity
	}
	pet, err := h.service.Update(ctx, who, request.PetId.String(), inputFromAPI(*request.Body))
	if err != nil {
		switch kind, body := classify(err); kind {
		case failureInvalid:
			return api.UpdatePet400JSONResponse{InvalidRequestJSONResponse: api.InvalidRequestJSONResponse(body)}, nil
		case failureOwnerNotFound, failurePetNotFound:
			return api.UpdatePet404JSONResponse{PetNotFoundJSONResponse: api.PetNotFoundJSONResponse(body)}, nil
		default:
			return nil, fmt.Errorf("update pet: %w", err)
		}
	}
	converted, err := petToAPI(pet)
	if err != nil {
		return nil, err
	}
	return api.UpdatePet200JSONResponse(converted), nil
}

// DeletePet deletes a pet of the owner that made the request.
func (h *Handlers) DeletePet(
	ctx context.Context,
	request api.DeletePetRequestObject,
) (api.DeletePetResponseObject, error) {
	who, ok := identity.FromContext(ctx)
	if !ok {
		return nil, errNoIdentity
	}
	if err := h.service.Delete(ctx, who, request.PetId.String()); err != nil {
		switch kind, body := classify(err); kind {
		case failureOwnerNotFound, failurePetNotFound:
			return api.DeletePet404JSONResponse{PetNotFoundJSONResponse: api.PetNotFoundJSONResponse(body)}, nil
		default:
			return nil, fmt.Errorf("delete pet: %w", err)
		}
	}
	return api.DeletePet204Response{}, nil
}

// SetPetPhoto stores the profile photo of a pet of the owner that made the
// request. The photo is the part "file" of the multipart body.
func (h *Handlers) SetPetPhoto(
	ctx context.Context,
	request api.SetPetPhotoRequestObject,
) (api.SetPetPhotoResponseObject, error) {
	who, ok := identity.FromContext(ctx)
	if !ok {
		return nil, errNoIdentity
	}
	invalid := func(message string) api.SetPetPhotoResponseObject {
		return api.SetPetPhoto400JSONResponse{InvalidRequestJSONResponse: api.InvalidRequestJSONResponse{
			Error:   api.ErrorCodeInvalidRequest,
			Message: message,
		}}
	}
	for {
		part, err := request.Body.NextPart()
		if errors.Is(err, io.EOF) {
			return invalid(`the body has no part "file"`), nil
		}
		if err != nil {
			return invalid("the multipart body could not be read"), nil
		}
		if part.FormName() != "file" {
			continue
		}
		pet, err := h.service.SetPhoto(ctx, who, request.PetId.String(), part)
		if err != nil {
			switch kind, body := classify(err); kind {
			case failureInvalid:
				return invalid(body.Message), nil
			case failureOwnerNotFound, failurePetNotFound:
				return api.SetPetPhoto404JSONResponse{PetNotFoundJSONResponse: api.PetNotFoundJSONResponse(body)}, nil
			default:
				return nil, fmt.Errorf("set the photo of the pet: %w", err)
			}
		}
		converted, err := petToAPI(pet)
		if err != nil {
			return nil, err
		}
		return api.SetPetPhoto200JSONResponse(converted), nil
	}
}

func inputFromAPI(body api.PetInput) Input {
	input := Input{
		Name:      body.Name,
		Species:   string(body.Species),
		Breed:     body.Breed,
		WeightKg:  body.WeightKg,
		Neutered:  body.Neutered,
		VetName:   body.VetName,
		VetClinic: body.VetClinic,
		VetPhone:  body.VetPhone,
	}
	if body.Sex != nil {
		sex := string(*body.Sex)
		input.Sex = &sex
	}
	if body.Size != nil {
		size := string(*body.Size)
		input.Size = &size
	}
	if body.BirthDate != nil {
		input.BirthDate = &body.BirthDate.Time
	}
	return input
}

func petToAPI(pet Pet) (api.Pet, error) {
	var id openapi_types.UUID
	if err := id.UnmarshalText([]byte(pet.ID)); err != nil {
		return api.Pet{}, fmt.Errorf("parse the identifier of the pet %q: %w", pet.ID, err)
	}
	converted := api.Pet{
		Id:        id,
		CreatedAt: pet.CreatedAt,
		Name:      pet.Name,
		Species:   api.Species(pet.Species),
		Breed:     pet.Breed,
		WeightKg:  pet.WeightKg,
		Neutered:  pet.Neutered,
		VetName:   pet.VetName,
		VetClinic: pet.VetClinic,
		VetPhone:  pet.VetPhone,
		PhotoUrl:  pet.PhotoURL,
	}
	if pet.Sex != nil {
		sex := api.Sex(*pet.Sex)
		converted.Sex = &sex
	}
	if pet.Size != nil {
		size := api.Size(*pet.Size)
		converted.Size = &size
	}
	if pet.BirthDate != nil {
		converted.BirthDate = &openapi_types.Date{Time: *pet.BirthDate}
	}
	return converted, nil
}
