package telemetry_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"go.opentelemetry.io/otel"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"

	"github.com/mcoldibelli/nupii/backend/internal/platform/telemetry"
)

// ADR 0032, item 3: with no endpoint, the API exports nothing and the global
// providers stay the no-op providers of otel.
func TestStartWithoutEndpointExportsNothing(t *testing.T) {
	shutdown, err := telemetry.Start(context.Background(), "")
	if err != nil {
		t.Fatalf("Start: %v", err)
	}
	if _, ok := otel.GetTracerProvider().(*sdktrace.TracerProvider); ok {
		t.Fatal("the global tracer provider is the SDK provider, want the no-op provider")
	}
	if err := shutdown(context.Background()); err != nil {
		t.Fatalf("shutdown: %v", err)
	}
}

// ADR 0032, items 2 and 3: with an endpoint, a span and the metrics go to the
// collector by OTLP over HTTP, at the latest when the API stops.
func TestStartExportsTracesAndMetricsToTheEndpoint(t *testing.T) {
	var mu sync.Mutex
	paths := map[string]int{}
	collector := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		paths[r.URL.Path]++
		mu.Unlock()
	}))
	defer collector.Close()

	shutdown, err := telemetry.Start(context.Background(), collector.URL)
	if err != nil {
		t.Fatalf("Start: %v", err)
	}
	_, span := otel.Tracer("test").Start(context.Background(), "work")
	span.End()
	counter, err := otel.Meter("test").Int64Counter("work.count")
	if err != nil {
		t.Fatalf("counter: %v", err)
	}
	counter.Add(context.Background(), 1)
	if err := shutdown(context.Background()); err != nil {
		t.Fatalf("shutdown: %v", err)
	}

	mu.Lock()
	defer mu.Unlock()
	if paths["/v1/traces"] == 0 || paths["/v1/metrics"] == 0 {
		t.Fatalf("collector got %v, want /v1/traces and /v1/metrics", paths)
	}
}
