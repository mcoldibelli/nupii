// Package httpx has the HTTP middleware of the API.
package httpx

import (
	"context"
	"crypto/rand"
	"log/slog"
	"net/http"
	"time"

	"go.opentelemetry.io/otel/trace"
)

// RequestIDHeader is the response header that has the request identifier.
const RequestIDHeader = "X-Request-Id"

type requestIDKey struct{}

// logHandler adds the request identifier of the context to each record.
type logHandler struct {
	slog.Handler
}

// NewLogHandler wraps next. The returned handler adds the attributes
// request_id and trace_id to each record that is logged with the context of
// a request.
// Use the Context functions of slog (InfoContext, ErrorContext) so that the
// handler gets that context.
func NewLogHandler(next slog.Handler) slog.Handler {
	return logHandler{Handler: next}
}

func (h logHandler) Handle(ctx context.Context, record slog.Record) error {
	if id, ok := ctx.Value(requestIDKey{}).(string); ok {
		record.AddAttrs(slog.String("request_id", id))
	}
	// ADR 0032, item 4: Grafana opens the trace of a log line by this value.
	if span := trace.SpanContextFromContext(ctx); span.HasTraceID() {
		record.AddAttrs(slog.String("trace_id", span.TraceID().String()))
	}
	return h.Handler.Handle(ctx, record)
}

func (h logHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return logHandler{Handler: h.Handler.WithAttrs(attrs)}
}

func (h logHandler) WithGroup(name string) slog.Handler {
	return logHandler{Handler: h.Handler.WithGroup(name)}
}

// RequestID returns the identifier of the request of ctx, or an empty
// string when ctx is not the context of a request.
func RequestID(ctx context.Context) string {
	id, _ := ctx.Value(requestIDKey{}).(string)
	return id
}

// RequestLog returns a middleware that gives each request a new identifier.
// The middleware sends the identifier in the X-Request-Id response header,
// puts it in the context of the request and writes one log line when the
// request ends.
func RequestLog(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			id := rand.Text()
			ctx := context.WithValue(r.Context(), requestIDKey{}, id)
			w.Header().Set(RequestIDHeader, id)

			rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
			req := r.WithContext(ctx)
			next.ServeHTTP(rec, req)
			// The mux writes the route on req. The span gets its name, as
			// "GET /v1/pets/{petId}", and not the path with the identifiers.
			if req.Pattern != "" {
				trace.SpanFromContext(ctx).SetName(req.Pattern)
			}

			logger.LogAttrs(ctx, slog.LevelInfo, "http request",
				slog.String("method", r.Method),
				slog.String("path", r.URL.Path),
				slog.Int("status", rec.status),
				slog.Duration("duration", time.Since(start)),
			)
		})
	}
}

// statusRecorder keeps the status code that the handler wrote.
type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}
