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
