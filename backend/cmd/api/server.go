package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"runtime/debug"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mcoldibelli/nupii/backend/internal/api"
	"github.com/mcoldibelli/nupii/backend/internal/identity"
	"github.com/mcoldibelli/nupii/backend/internal/pets"
	"github.com/mcoldibelli/nupii/backend/internal/platform/firebase"
	"github.com/mcoldibelli/nupii/backend/internal/platform/httpx"
)

const (
	// _healthPingTimeout is the time the database has to answer the health
	// check.
	_healthPingTimeout = 2 * time.Second
	// _maxBodyBytes is the maximum size of the body of a request. The
	// operations of today have small JSON bodies.
	_maxBodyBytes = 1 << 20
)

// pinger tells if the database responds. *pgxpool.Pool implements it.
type pinger interface {
	Ping(ctx context.Context) error
}

// The handlers of two modules have the same type name. The aliases give
// each embedded field of server a different name.
type (
	identityHandlers = identity.Handlers
	petsHandlers     = pets.Handlers
)

// server implements the operations of the contract. The operations of each
// module come from the handlers of the module.
type server struct {
	*identityHandlers
	*petsHandlers

	logger   *slog.Logger
	database pinger
}

var _ api.StrictServerInterface = server{}

// newServer connects the modules: each module gets the connection pool and
// the modules it depends on.
func newServer(logger *slog.Logger, pool *pgxpool.Pool) server {
	owners := identity.NewService(pool)
	return server{
		identityHandlers: identity.NewHandlers(owners),
		petsHandlers:     pets.NewHandlers(pets.NewService(pool, owners)),
		logger:           logger,
		database:         pool,
	}
}

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
			Error:   api.ErrorCodeUnavailable,
			Message: "the database does not respond",
		}, nil
	}
	return api.GetHealth200JSONResponse{Status: api.HealthStatusOk}, nil
}

// isPublic tells if the route of the request needs no ID token. The
// contract has the same information: an operation without "security" is
// public. A test compares the two.
func isPublic(r *http.Request) bool {
	return r.Pattern == "GET /v1/health"
}

// tokenVerifier adapts the Firebase verifier to the interface of the
// identity module.
type tokenVerifier struct {
	firebase *firebase.Verifier
}

func (v tokenVerifier) VerifyIDToken(
	ctx context.Context,
	rawToken string,
) (identity.Identity, error) {
	token, err := v.firebase.VerifyIDToken(ctx, rawToken)
	if errors.Is(err, firebase.ErrInvalidToken) {
		return identity.Identity{}, fmt.Errorf("%w: %w", identity.ErrInvalidToken, err)
	}
	if err != nil {
		return identity.Identity{}, fmt.Errorf("verify ID token with firebase: %w", err)
	}
	return identity.Identity{UID: token.UID, Email: token.Email}, nil
}

// newHandler returns the HTTP handler of the API: the routes of the
// contract for operations, with the request log around them. A route that
// is not public needs an ID token that verifier accepts. All the error
// responses use the Error format of the contract.
func newHandler(
	logger *slog.Logger,
	operations api.StrictServerInterface,
	verifier identity.TokenVerifier,
) http.Handler {
	invalidRequest := func(w http.ResponseWriter, r *http.Request, err error) {
		httpx.WriteError(r.Context(), logger, w,
			http.StatusBadRequest, string(api.ErrorCodeInvalidRequest), err.Error())
	}
	strict := api.NewStrictHandlerWithOptions(operations, nil, api.StrictHTTPServerOptions{
		// The body of the request could not be decoded.
		RequestErrorHandlerFunc: invalidRequest,
		// An operation returned an error. The detail goes to the log and
		// not to the client.
		ResponseErrorHandlerFunc: func(w http.ResponseWriter, r *http.Request, err error) {
			logger.ErrorContext(r.Context(), "operation failed", slog.Any("error", err))
			httpx.WriteInternalError(r.Context(), logger, w)
		},
	})

	mux := http.NewServeMux()
	// This pattern gets each request that no route of the contract gets,
	// also a request with a method that the route does not have.
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		httpx.WriteError(r.Context(), logger, w,
			http.StatusNotFound, string(api.ErrorCodeNotFound), "no route for "+r.Method+" "+r.URL.Path)
	})
	routes := api.HandlerWithOptions(strict, api.StdHTTPServerOptions{
		BaseRouter: mux,
		// The last middleware of the list runs first: the identity check
		// runs before the body of the request is read.
		Middlewares: []api.MiddlewareFunc{
			httpx.LimitBody(_maxBodyBytes),
			identity.RequireIdentity(logger, verifier, isPublic),
		},
		// A parameter of the request could not be read.
		ErrorHandlerFunc: invalidRequest,
	})

	return httpx.RequestLog(logger)(recoverPanic(logger, routes))
}

// recoverPanic answers with the internal error of the contract when next
// panics, and writes the panic value and the stack to the log. It is inside
// the request log, so the request still gets its log line.
func recoverPanic(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			value := recover()
			if value == nil {
				return
			}
			// net/http uses this value to abort a response without a log.
			if value == http.ErrAbortHandler {
				panic(value)
			}
			logger.ErrorContext(r.Context(), "handler panic",
				slog.Any("panic", value),
				slog.String("stack", string(debug.Stack())),
			)
			httpx.WriteInternalError(r.Context(), logger, w)
		}()
		next.ServeHTTP(w, r)
	})
}
