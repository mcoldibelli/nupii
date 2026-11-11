package main

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/mcoldibelli/nupii/backend/internal/api"
	"github.com/mcoldibelli/nupii/backend/internal/platform/httpx"
)

// _healthPingTimeout is the time the database has to answer the health check.
const _healthPingTimeout = 2 * time.Second

// pinger tells if the database responds. *pgxpool.Pool implements it.
type pinger interface {
	Ping(ctx context.Context) error
}

// server implements the operations of the contract.
type server struct {
	logger   *slog.Logger
	database pinger
}

var _ api.StrictServerInterface = server{}

// GetHealth reports that the process is running and that the database
// responds.
func (s server) GetHealth(
	ctx context.Context,
	_ api.GetHealthRequestObject,
) (api.GetHealthResponseObject, error) {
	pingCtx, cancel := context.WithTimeout(ctx, _healthPingTimeout)
	defer cancel()
	if err := s.database.Ping(pingCtx); err != nil {
		s.logger.ErrorContext(ctx, "health check: database does not respond", slog.Any("error", err))
		return api.GetHealth503JSONResponse{
			Error:   api.Unavailable,
			Message: "the database does not respond",
		}, nil
	}
	return api.GetHealth200JSONResponse{Status: api.Ok}, nil
}

// newHandler returns the HTTP handler of the API: the routes of the
// contract for operations, with the request log around them. All the error
// responses use the Error format of the contract.
func newHandler(logger *slog.Logger, operations api.StrictServerInterface) http.Handler {
	strict := api.NewStrictHandlerWithOptions(operations, nil, api.StrictHTTPServerOptions{
		// An operation returned an error. The detail goes to the log and
		// not to the client.
		ResponseErrorHandlerFunc: func(w http.ResponseWriter, r *http.Request, err error) {
			logger.ErrorContext(r.Context(), "operation failed", slog.Any("error", err))
			writeError(r.Context(), logger, w,
				http.StatusInternalServerError, api.InternalError, "internal error")
		},
	})

	mux := http.NewServeMux()
	// This pattern gets each request that no route of the contract gets,
	// also a request with a method that the route does not have.
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		writeError(r.Context(), logger, w,
			http.StatusNotFound, api.NotFound, "no route for "+r.Method+" "+r.URL.Path)
	})
	routes := api.HandlerFromMux(strict, mux)

	return httpx.RequestLog(logger)(routes)
}

// writeError writes an error response in the Error format of the contract.
func writeError(
	ctx context.Context,
	logger *slog.Logger,
	w http.ResponseWriter,
	status int,
	code api.ErrorCode,
	message string,
) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(api.Error{Error: code, Message: message}); err != nil {
		logger.ErrorContext(ctx, "write error response", slog.Any("error", err))
	}
}
