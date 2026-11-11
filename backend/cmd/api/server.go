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

	"github.com/mcoldibelli/nupii/backend/internal/alerts"
	"github.com/mcoldibelli/nupii/backend/internal/api"
	"github.com/mcoldibelli/nupii/backend/internal/biometrics"
	"github.com/mcoldibelli/nupii/backend/internal/health"
	"github.com/mcoldibelli/nupii/backend/internal/identity"
	"github.com/mcoldibelli/nupii/backend/internal/pets"
	"github.com/mcoldibelli/nupii/backend/internal/platform/firebase"
	"github.com/mcoldibelli/nupii/backend/internal/platform/httpx"
	"github.com/mcoldibelli/nupii/backend/internal/platform/storage"
	"github.com/mcoldibelli/nupii/backend/internal/reports"
)

const (
	// _healthPingTimeout is the time the database has to answer the health
	// check.
	_healthPingTimeout = 2 * time.Second
	// _maxBodyBytes is the maximum size of a JSON request body.
	_maxBodyBytes = 1 << 20
	// _maxPhotoBodyBytes is the maximum size of the body of a photo
	// upload: the 5 MB of the photo (RN-54) and the multipart envelope.
	_maxPhotoBodyBytes = 6 << 20
	// _publicPostLimit is the number of POST requests that one address
	// can send to one public route in one minute (RN-43).
	_publicPostLimit = 10
	// _maxNosePhotoBodyBytes is the maximum size of the body of an upload
	// of the photo of a nose: the 8 MB of the photo (RN-59) and the
	// multipart envelope.
	_maxNosePhotoBodyBytes = 9 << 20
)

// bodyLimit returns the maximum size of the body of the request.
func bodyLimit(r *http.Request) int64 {
	switch r.Pattern {
	case "PUT /v1/pets/{petId}/photo":
		return _maxPhotoBodyBytes
	case "POST /v1/pets/{petId}/noseprints",
		"POST /v1/reports/found",
		"POST /v1/identifications",
		"POST /v1/identifications/{identificationId}/confirmation":
		return _maxNosePhotoBodyBytes
	default:
		return _maxBodyBytes
	}
}

// pinger tells if the database responds. *pgxpool.Pool implements it.
type pinger interface {
	Ping(ctx context.Context) error
}

// The handlers of the modules have the same type name. The aliases give
// each embedded field of server a different name.
type (
	identityHandlers   = identity.Handlers
	petsHandlers       = pets.Handlers
	biometricsHandlers = biometrics.Handlers
	reportsHandlers    = reports.Handlers
	alertsHandlers     = alerts.Handlers
	healthHandlers     = health.Handlers
)

// server implements the operations of the contract. The operations of each
// module come from the handlers of the module.
type server struct {
	*identityHandlers
	*petsHandlers
	*biometricsHandlers
	*reportsHandlers
	*alertsHandlers
	*healthHandlers

	// noseprints runs the recompute of the vectors when the API starts.
	noseprints *biometrics.Service

	logger   *slog.Logger
	database pinger
}

var _ api.StrictServerInterface = server{}

// newServer connects the modules: each module gets the connection pool and
// the modules it depends on.
func newServer(
	logger *slog.Logger,
	pool *pgxpool.Pool,
	photos *storage.Store,
	embedder biometrics.Embedder,
) server {
	owners := identity.NewService(pool)
	petService := pets.NewService(pool, owners, photos, logger)
	noseprints := biometrics.NewService(pool, owners, petService, embedder, photos, logger)
	return server{
		identityHandlers:   identity.NewHandlers(owners),
		petsHandlers:       pets.NewHandlers(petService),
		biometricsHandlers: biometrics.NewHandlers(noseprints, logger),
		reportsHandlers: reports.NewHandlers(
			reports.NewService(pool, owners, petService, photos, logger)),
		alertsHandlers: alerts.NewHandlers(alerts.NewService(pool, owners)),
		healthHandlers: health.NewHandlers(health.NewService(pool, owners, petService)),
		noseprints:     noseprints,
		logger:         logger,
		database:       pool,
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
	switch r.Pattern {
	case "GET /v1/health",
		"POST /v1/identifications",
		"POST /v1/identifications/{identificationId}/confirmation",
		"GET /v1/reports",
		"GET /v1/reports/{reportId}",
		"POST /v1/reports/found",
		"POST /v1/reports/{reportId}/sightings",
		"POST /v1/reports/{reportId}/code-resolution":
		return true
	default:
		return false
	}
}

// isRateLimited tells if the request counts for the limit of RN-43.
//
// RN-43: um endpoint público aceita no máximo 10 POST por minuto, por IP e
// por caminho.
func isRateLimited(r *http.Request) bool {
	return r.Method == http.MethodPost && isPublic(r)
}

// allowOtherOrigins lets a web page of another origin read the answer of a
// public route: the public web page calls the API from the browser. A
// public route has no credential, so every origin is accepted. The other
// routes get no header, and the browser keeps their answers from other
// origins.
func allowOtherOrigins(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if isPublic(r) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		}
		next.ServeHTTP(w, r)
	})
}

// answerPreflight answers the preflight request that a browser sends before
// a request to another origin with a JSON body. Only a public route gets
// the answer that allows the request. mux finds the route of the request.
func answerPreflight(mux *http.ServeMux, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		method := r.Header.Get("Access-Control-Request-Method")
		if r.Method != http.MethodOptions || method == "" {
			next.ServeHTTP(w, r)
			return
		}
		// The route that would get the real request.
		real := r.Clone(r.Context())
		real.Method = method
		if _, real.Pattern = mux.Handler(real); !isPublic(real) {
			next.ServeHTTP(w, r)
			return
		}
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", method)
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.WriteHeader(http.StatusNoContent)
	})
}

// firebasePusher adapts the sender of Firebase Cloud Messaging to the
// interface of the alerts module.
type firebasePusher struct {
	firebase *firebase.Pusher
}

func (p firebasePusher) Send(
	ctx context.Context,
	tokens []string,
	message alerts.PushMessage,
) (alerts.PushResult, error) {
	result, err := p.firebase.Send(ctx, tokens, message.Title, message.Body, message.Data)
	if err != nil {
		return alerts.PushResult{}, fmt.Errorf("send with firebase: %w", err)
	}
	return alerts.PushResult{Sent: result.Sent, InvalidTokens: result.InvalidTokens}, nil
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
			httpx.LimitBody(bodyLimit),
			httpx.RateLimit(logger, _publicPostLimit, time.Minute, isRateLimited, time.Now),
			identity.RequireIdentity(logger, verifier, isPublic),
			allowOtherOrigins,
		},
		// A parameter of the request could not be read.
		ErrorHandlerFunc: invalidRequest,
	})

	return httpx.RequestLog(logger)(recoverPanic(logger, answerPreflight(mux, routes)))
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
