package postgres

import (
	"context"
	"strings"

	"github.com/jackc/pgx/v5"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

// queryTracer makes one span for each query of the pool (ADR 0032, item 4).
// The span has the text of the query and not its arguments, which have
// personal data.
type queryTracer struct {
	tracer trace.Tracer
}

var _ pgx.QueryTracer = queryTracer{}

func (t queryTracer) TraceQueryStart(ctx context.Context, _ *pgx.Conn, data pgx.TraceQueryStartData) context.Context {
	ctx, _ = t.tracer.Start(ctx, queryName(data.SQL), trace.WithSpanKind(trace.SpanKindClient),
		trace.WithAttributes(attribute.String("db.system.name", "postgresql"), attribute.String("db.query.text", data.SQL)))
	return ctx
}

func (t queryTracer) TraceQueryEnd(ctx context.Context, _ *pgx.Conn, data pgx.TraceQueryEndData) {
	span := trace.SpanFromContext(ctx)
	if data.Err != nil {
		span.RecordError(data.Err)
		span.SetStatus(codes.Error, data.Err.Error())
	}
	span.End()
}

// queryName is the name that sqlc writes on the first line of a query
// ("-- name: GetPet :one"), or "db.query".
func queryName(sql string) string {
	rest, found := strings.CutPrefix(sql, "-- name: ")
	if !found {
		return "db.query"
	}
	name, _, _ := strings.Cut(rest, " ")
	return name
}
