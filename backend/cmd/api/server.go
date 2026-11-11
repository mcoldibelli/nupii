package main

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/mcoldibelli/nupii/backend/internal/api"
	"github.com/mcoldibelli/nupii/backend/internal/platform/httpx"
)

// server implements the operations of the contract.
type server struct{}

var _ api.StrictServerInterface = server{}

// GetHealth reports that the process is running.
func (server) GetHealth(context.Context, api.GetHealthRequestObject) (api.GetHealthResponseObject, error) {
	return api.GetHealth200JSONResponse{Status: api.Ok}, nil
}

// newHandler returns the HTTP handler of the API: the routes of the
// contract, with the request log around them.
func newHandler(logger *slog.Logger) http.Handler {
	routes := api.Handler(api.NewStrictHandler(server{}, nil))
	return httpx.RequestLog(logger)(routes)
}
