package reports

import (
	"context"
	"errors"
	"fmt"
	"mime/multipart"
	"net/http"
	"strconv"

	"github.com/oapi-codegen/runtime/types"

	"github.com/mcoldibelli/nupii/backend/internal/api"
	"github.com/mcoldibelli/nupii/backend/internal/identity"
	"github.com/mcoldibelli/nupii/backend/internal/pets"
	"github.com/mcoldibelli/nupii/backend/internal/platform/httpx"
)

// Handlers implements the report operations of the contract.
type Handlers struct {
	service *Service
}

// NewHandlers returns the handlers that use service.
func NewHandlers(service *Service) *Handlers {
	return &Handlers{service: service}
}

// classify returns the HTTP status and the body of the response for an
// error of the service. The status is 0 for an error that has no response
// in the contract: the caller returns it as an internal error.
func classify(err error) (int, api.Error) {
	var validation *ValidationError
	switch {
	case errors.As(err, &validation):
		return http.StatusBadRequest, api.Error{
			Error: api.ErrorCodeInvalidRequest, Message: validation.Message,
		}
	case errors.Is(err, ErrReportNotFound):
		return http.StatusNotFound, api.Error{
			Error: api.ErrorCodeReportNotFound, Message: "the report does not exist",
		}
	case errors.Is(err, pets.ErrPetNotFound):
		return http.StatusNotFound, api.Error{
			Error: api.ErrorCodePetNotFound, Message: "the pet does not exist for this owner",
		}
	case errors.Is(err, identity.ErrOwnerNotFound):
		return http.StatusNotFound, api.Error{
			Error: api.ErrorCodeOwnerNotFound, Message: "the account has no owner yet",
		}
	case errors.Is(err, ErrLostReportOpen):
		return http.StatusConflict, api.Error{
			Error: api.ErrorCodeLostReportOpen, Message: "the pet already has an open lost report",
		}
	case errors.Is(err, ErrReportNotOpen):
		return http.StatusConflict, api.Error{
			Error: api.ErrorCodeReportNotOpen, Message: "the report is not an open lost report",
		}
	default:
		return 0, api.Error{}
	}
}

// ListReports returns one page of the board. It is a public operation.
func (h *Handlers) ListReports(
	ctx context.Context,
	request api.ListReportsRequestObject,
) (api.ListReportsResponseObject, error) {
	page := 1
	if request.Params.Page != nil {
		page = *request.Params.Page
	}
	board, err := h.service.Board(ctx, page)
	if err != nil {
		if status, body := classify(err); status == http.StatusBadRequest {
			return api.ListReports400JSONResponse{
				InvalidRequestJSONResponse: api.InvalidRequestJSONResponse(body),
			}, nil
		}
		return nil, fmt.Errorf("list reports: %w", err)
	}
	converted, err := reportsToAPI(board.Reports)
	if err != nil {
		return nil, err
	}
	return api.ListReports200JSONResponse{
		Reports:   converted,
		Page:      board.Page,
		HasNext:   board.HasNext,
		OpenLost:  int(board.OpenLost),
		OpenFound: int(board.OpenFound),
	}, nil
}

// GetReport returns the detail of a report. It is a public operation.
func (h *Handlers) GetReport(
	ctx context.Context,
	request api.GetReportRequestObject,
) (api.GetReportResponseObject, error) {
	report, err := h.service.Get(ctx, request.ReportId.String())
	if err != nil {
		if status, body := classify(err); status == http.StatusNotFound {
			return api.GetReport404JSONResponse{
				ReportNotFoundJSONResponse: api.ReportNotFoundJSONResponse(body),
			}, nil
		}
		return nil, fmt.Errorf("get report: %w", err)
	}
	converted, err := reportToAPI(report)
	if err != nil {
		return nil, err
	}
	return api.GetReport200JSONResponse(converted), nil
}

// ReportLost registers a lost pet of the owner that made the request.
func (h *Handlers) ReportLost(
	ctx context.Context,
	request api.ReportLostRequestObject,
) (api.ReportLostResponseObject, error) {
	body := request.Body
	invalid := func(message string) api.ReportLostResponseObject {
		return api.ReportLost400JSONResponse{
			InvalidRequestJSONResponse: api.InvalidRequestJSONResponse{
				Error: api.ErrorCodeInvalidRequest, Message: message,
			},
		}
	}
	// A JSON body without petId decodes to the zero UUID.
	if body.PetId == (types.UUID{}) {
		return invalid("petId is required"), nil
	}
	// RN-70: o desaparecimento tem latitude e longitude obrigatórias.
	if body.Latitude == nil || body.Longitude == nil {
		return invalid("latitude and longitude are required"), nil
	}
	report, err := h.service.ReportLost(ctx, LostInput{
		PetID:      body.PetId.String(),
		Point:      Point{Latitude: *body.Latitude, Longitude: *body.Longitude},
		Details:    Details{Place: body.Place, Description: body.Description},
		OccurredAt: body.OccurredAt,
	})
	if err != nil {
		switch status, errBody := classify(err); status {
		case http.StatusBadRequest:
			return api.ReportLost400JSONResponse{
				InvalidRequestJSONResponse: api.InvalidRequestJSONResponse(errBody),
			}, nil
		case http.StatusNotFound:
			return api.ReportLost404JSONResponse{
				PetNotFoundJSONResponse: api.PetNotFoundJSONResponse(errBody),
			}, nil
		case http.StatusConflict:
			return api.ReportLost409JSONResponse(errBody), nil
		default:
			return nil, fmt.Errorf("report lost: %w", err)
		}
	}
	converted, err := reportToAPI(report)
	if err != nil {
		return nil, err
	}
	return api.ReportLost201JSONResponse(converted), nil
}

// ReportFound publishes a found dog. It is a public operation.
func (h *Handlers) ReportFound(
	ctx context.Context,
	request api.ReportFoundRequestObject,
) (api.ReportFoundResponseObject, error) {
	report, code, err := h.reportFound(ctx, request.Body)
	if err != nil {
		if status, body := classify(err); status == http.StatusBadRequest {
			return api.ReportFound400JSONResponse{
				InvalidRequestJSONResponse: api.InvalidRequestJSONResponse(body),
			}, nil
		}
		return nil, fmt.Errorf("report found: %w", err)
	}
	converted, err := reportToAPI(report)
	if err != nil {
		return nil, err
	}
	return api.ReportFound201JSONResponse{Report: converted, ResolveCode: code}, nil
}

func (h *Handlers) reportFound(
	ctx context.Context,
	body *multipart.Reader,
) (Report, string, error) {
	parts, err := httpx.ReadForm(body, _maxPhotoBytes)
	if err != nil {
		return Report{}, "", &ValidationError{Message: err.Error()}
	}
	if parts.File == nil {
		return Report{}, "", &ValidationError{Message: `the body has no part "file"`}
	}
	point, err := requiredPoint(parts.Fields)
	if err != nil {
		return Report{}, "", err
	}
	details := Details{
		Place:       field(parts.Fields, "place"),
		Description: field(parts.Fields, "description"),
	}
	return h.service.ReportFound(ctx, parts.File, point, details)
}

// requiredPoint reads the fields latitude and longitude.
func requiredPoint(fields map[string]string) (Point, error) {
	latitude, err := strconv.ParseFloat(fields["latitude"], 64)
	if err != nil {
		return Point{}, &ValidationError{Message: "latitude is required and must be a number"}
	}
	longitude, err := strconv.ParseFloat(fields["longitude"], 64)
	if err != nil {
		return Point{}, &ValidationError{Message: "longitude is required and must be a number"}
	}
	return Point{Latitude: latitude, Longitude: longitude}, nil
}

// field returns the text of a field, or nil when the form does not have it.
func field(fields map[string]string, name string) *string {
	if value, ok := fields[name]; ok {
		return &value
	}
	return nil
}

// ReportSighting registers a sighting of a lost pet. It is a public
// operation.
func (h *Handlers) ReportSighting(
	ctx context.Context,
	request api.ReportSightingRequestObject,
) (api.ReportSightingResponseObject, error) {
	body := request.Body
	var point *Point
	// RN-28: latitude e longitude vêm juntas ou não vêm.
	switch {
	case body.Latitude != nil && body.Longitude != nil:
		point = &Point{Latitude: *body.Latitude, Longitude: *body.Longitude}
	case body.Latitude != nil || body.Longitude != nil:
		return api.ReportSighting400JSONResponse{
			InvalidRequestJSONResponse: api.InvalidRequestJSONResponse{
				Error:   api.ErrorCodeInvalidRequest,
				Message: "latitude and longitude must come together",
			},
		}, nil
	}
	details := Details{Place: body.Place, Description: body.Description}
	sighting, err := h.service.AddSighting(ctx, request.ReportId.String(), point, details)
	if err != nil {
		switch status, errBody := classify(err); status {
		case http.StatusBadRequest:
			return api.ReportSighting400JSONResponse{
				InvalidRequestJSONResponse: api.InvalidRequestJSONResponse(errBody),
			}, nil
		case http.StatusNotFound:
			return api.ReportSighting404JSONResponse{
				ReportNotFoundJSONResponse: api.ReportNotFoundJSONResponse(errBody),
			}, nil
		case http.StatusConflict:
			return api.ReportSighting409JSONResponse(errBody), nil
		default:
			return nil, fmt.Errorf("report sighting: %w", err)
		}
	}
	converted, err := sightingToAPI(sighting)
	if err != nil {
		return nil, err
	}
	return api.ReportSighting201JSONResponse(converted), nil
}

// ResolveReport resolves a report of the owner that made the request.
func (h *Handlers) ResolveReport(
	ctx context.Context,
	request api.ResolveReportRequestObject,
) (api.ResolveReportResponseObject, error) {
	report, err := h.service.Resolve(ctx, request.ReportId.String())
	if err != nil {
		// An account with no owner has no report, so the answer is the same.
		if status, _ := classify(err); status == http.StatusNotFound {
			_, body := classify(ErrReportNotFound)
			return api.ResolveReport404JSONResponse{
				ReportNotFoundJSONResponse: api.ReportNotFoundJSONResponse(body),
			}, nil
		}
		return nil, fmt.Errorf("resolve report: %w", err)
	}
	converted, err := reportToAPI(report)
	if err != nil {
		return nil, err
	}
	return api.ResolveReport200JSONResponse(converted), nil
}

// ResolveFoundReport resolves a found report with its code. It is a public
// operation.
func (h *Handlers) ResolveFoundReport(
	ctx context.Context,
	request api.ResolveFoundReportRequestObject,
) (api.ResolveFoundReportResponseObject, error) {
	report, err := h.service.ResolveWithCode(ctx, request.ReportId.String(), request.Body.Code)
	if err != nil {
		if status, body := classify(err); status == http.StatusNotFound {
			return api.ResolveFoundReport404JSONResponse{
				ReportNotFoundJSONResponse: api.ReportNotFoundJSONResponse(body),
			}, nil
		}
		return nil, fmt.Errorf("resolve found report: %w", err)
	}
	converted, err := reportToAPI(report)
	if err != nil {
		return nil, err
	}
	return api.ResolveFoundReport200JSONResponse(converted), nil
}

// ListMyReports returns the reports of the owner that made the request.
func (h *Handlers) ListMyReports(
	ctx context.Context,
	_ api.ListMyReportsRequestObject,
) (api.ListMyReportsResponseObject, error) {
	reports, err := h.service.Mine(ctx)
	if err != nil {
		if status, body := classify(err); status == http.StatusNotFound {
			return api.ListMyReports404JSONResponse{
				OwnerNotFoundJSONResponse: api.OwnerNotFoundJSONResponse(body),
			}, nil
		}
		return nil, fmt.Errorf("list my reports: %w", err)
	}
	converted, err := reportsToAPI(reports)
	if err != nil {
		return nil, err
	}
	return api.ListMyReports200JSONResponse{Reports: converted}, nil
}

func reportsToAPI(reports []Report) ([]api.Report, error) {
	converted := make([]api.Report, 0, len(reports))
	for _, report := range reports {
		item, err := reportToAPI(report)
		if err != nil {
			return nil, err
		}
		converted = append(converted, item)
	}
	return converted, nil
}

func reportToAPI(report Report) (api.Report, error) {
	converted := api.Report{
		Type:        api.ReportType(report.Type),
		Status:      api.ReportStatus(report.Status),
		PetName:     report.PetName,
		PhotoUrl:    report.PhotoURL,
		Latitude:    report.Point.Latitude,
		Longitude:   report.Point.Longitude,
		Place:       report.Details.Place,
		Description: report.Details.Description,
		OccurredAt:  report.OccurredAt,
		CreatedAt:   report.CreatedAt,
		Sightings:   make([]api.Sighting, 0, len(report.Sightings)),
	}
	if err := converted.Id.UnmarshalText([]byte(report.ID)); err != nil {
		return api.Report{}, fmt.Errorf("parse the id of the report %q: %w", report.ID, err)
	}
	if report.PetID != nil {
		var petID types.UUID
		if err := petID.UnmarshalText([]byte(*report.PetID)); err != nil {
			return api.Report{}, fmt.Errorf("parse the pet id of the report %q: %w",
				report.ID, err)
		}
		species := api.Species(*report.PetSpecies)
		hasNoseprint := report.PetHasNoseprint
		converted.PetId = &petID
		converted.PetSpecies = &species
		converted.PetHasNoseprint = &hasNoseprint
	}
	for _, sighting := range report.Sightings {
		item, err := sightingToAPI(sighting)
		if err != nil {
			return api.Report{}, err
		}
		converted.Sightings = append(converted.Sightings, item)
	}
	return converted, nil
}

func sightingToAPI(sighting Sighting) (api.Sighting, error) {
	converted := api.Sighting{
		Latitude:    sighting.Point.Latitude,
		Longitude:   sighting.Point.Longitude,
		Place:       sighting.Details.Place,
		Description: sighting.Details.Description,
		CreatedAt:   sighting.CreatedAt,
	}
	if err := converted.Id.UnmarshalText([]byte(sighting.ID)); err != nil {
		return api.Sighting{}, fmt.Errorf("parse the id of the sighting %q: %w", sighting.ID, err)
	}
	return converted, nil
}
