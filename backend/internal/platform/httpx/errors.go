package httpx

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
)

// errorBody is the single error format of the API. The contract declares it
// as the schema Error.
type errorBody struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

// WriteError writes an error response in the single error format of the
// API. The code is one of the error codes of the contract. The message is
// for diagnosis: the client does not show it to the user.
func WriteError(
	ctx context.Context,
	logger *slog.Logger,
	w http.ResponseWriter,
	status int,
	code string,
	message string,
) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(errorBody{Error: code, Message: message}); err != nil {
		logger.ErrorContext(ctx, "write error response", slog.Any("error", err))
	}
}

// WriteInternalError writes the 500 response of the API. The cause of the
// error goes to the log of the caller and not to the client.
func WriteInternalError(ctx context.Context, logger *slog.Logger, w http.ResponseWriter) {
	WriteError(ctx, logger, w, http.StatusInternalServerError, "internal_error", "internal error")
}

// LimitBody returns a middleware that stops the read of a request body
// after the number of bytes that maxBytes gives for the request. The read
// then fails, and the handler answers with the error of an invalid request.
func LimitBody(maxBytes func(*http.Request) int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			r.Body = http.MaxBytesReader(w, r.Body, maxBytes(r))
			next.ServeHTTP(w, r)
		})
	}
}
