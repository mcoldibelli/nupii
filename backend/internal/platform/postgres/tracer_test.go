package postgres

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5"
	"go.opentelemetry.io/otel/codes"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
)

// ADR 0032, item 4: one span per query, named by the sqlc query, with the
// text of the query and never its arguments (they have personal data).
func TestQueryTracerRecordsOneSpanPerQueryWithoutTheArguments(t *testing.T) {
	recorder := tracetest.NewSpanRecorder()
	tracer := queryTracer{tracer: sdktrace.NewTracerProvider(sdktrace.WithSpanProcessor(recorder)).Tracer("test")}
	sql := "-- name: GetPet :one\nSELECT name FROM pets WHERE id = $1"

	ctx := tracer.TraceQueryStart(context.Background(), nil, pgx.TraceQueryStartData{SQL: sql, Args: []any{"secret@example.com"}})
	tracer.TraceQueryEnd(ctx, nil, pgx.TraceQueryEndData{})
	ctx = tracer.TraceQueryStart(context.Background(), nil, pgx.TraceQueryStartData{SQL: "SELECT 1"})
	tracer.TraceQueryEnd(ctx, nil, pgx.TraceQueryEndData{Err: errors.New("broken")})

	spans := recorder.Ended()
	if len(spans) != 2 {
		t.Fatalf("got %d spans, want 2", len(spans))
	}
	if got := spans[0].Name(); got != "GetPet" {
		t.Errorf("span name = %q, want GetPet", got)
	}
	if got := spans[1].Name(); got != "db.query" {
		t.Errorf("span name of a query without a sqlc name = %q, want db.query", got)
	}
	if spans[1].Status().Code != codes.Error {
		t.Errorf("status of a failed query = %v, want Error", spans[1].Status().Code)
	}
	for _, attr := range spans[0].Attributes() {
		if attr.Value.Emit() == "secret@example.com" {
			t.Errorf("attribute %s has the argument of the query", attr.Key)
		}
	}
}
