package identity

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/mcoldibelli/nupii/backend/internal/api"
	"github.com/mcoldibelli/nupii/backend/internal/platform/httpx"
)

// Identity is the account that made a request: the user of the identity
// provider, with the e-mail of the ID token.
type Identity struct {
	UID   string
	Email string
}

// ErrInvalidToken is the error of a TokenVerifier for a token that is
// malformed, expired, or not from this project.
var ErrInvalidToken = errors.New("invalid ID token")

// TokenVerifier validates the ID token of a request. For a token that is
// not valid, VerifyIDToken returns an error that wraps ErrInvalidToken.
// Any other error means that the verifier could not do the validation.
type TokenVerifier interface {
	VerifyIDToken(ctx context.Context, rawToken string) (Identity, error)
}

// AccountChecker tells if the account of a user is deleted. *Service
// implements it.
type AccountChecker interface {
	IsDeleted(ctx context.Context, uid string) (bool, error)
}

type identityKey struct{}

// FromContext returns the identity that RequireIdentity put in the context
// of the request.
func FromContext(ctx context.Context) (Identity, bool) {
	who, ok := ctx.Value(identityKey{}).(Identity)
	return who, ok
}

// RequireIdentity returns a middleware that validates the ID token of the
// header "Authorization: Bearer <token>" and puts the identity in the
// context of the request. A request for which isPublic returns true goes
// to next without a token.
//
// RN-46: uma chamada sem token, com token inválido ou com token vencido
// recebe 401.
// RN-04: uma conta excluída recebe 401, mesmo com um token ainda válido.
func RequireIdentity(
	logger *slog.Logger,
	verifier TokenVerifier,
	accounts AccountChecker,
	isPublic func(*http.Request) bool,
) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if isPublic(r) {
				next.ServeHTTP(w, r)
				return
			}
			ctx := r.Context()
			rawToken, ok := bearerToken(r)
			if !ok {
				unauthenticated(ctx, logger, w, "the Authorization header has no bearer token")
				return
			}
			who, err := verifier.VerifyIDToken(ctx, rawToken)
			if errors.Is(err, ErrInvalidToken) {
				unauthenticated(ctx, logger, w, "the ID token is not valid")
				return
			}
			if err != nil {
				logger.ErrorContext(ctx, "verify ID token", slog.Any("error", err))
				httpx.WriteInternalError(ctx, logger, w)
				return
			}
			deleted, err := accounts.IsDeleted(ctx, who.UID)
			if err != nil {
				logger.ErrorContext(ctx, "check if the account is deleted", slog.Any("error", err))
				httpx.WriteInternalError(ctx, logger, w)
				return
			}
			if deleted {
				unauthenticated(ctx, logger, w, "the account is deleted")
				return
			}
			next.ServeHTTP(w, r.WithContext(context.WithValue(ctx, identityKey{}, who)))
		})
	}
}

// bearerToken returns the token of the header "Authorization: Bearer <token>".
// The second result is false when the header has no bearer token.
func bearerToken(r *http.Request) (string, bool) {
	scheme, token, found := strings.Cut(r.Header.Get("Authorization"), " ")
	if !found || !strings.EqualFold(scheme, "Bearer") || token == "" {
		return "", false
	}
	return token, true
}

func unauthenticated(
	ctx context.Context,
	logger *slog.Logger,
	w http.ResponseWriter,
	message string,
) {
	w.Header().Set("WWW-Authenticate", "Bearer")
	httpx.WriteError(ctx, logger, w,
		http.StatusUnauthorized, string(api.ErrorCodeUnauthenticated), message)
}
