package httpx_test

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/metric/metricdata"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"

	"github.com/mcoldibelli/nupii/backend/internal/platform/httpx"
)

// logLines decodes the JSON lines that the logger wrote to buf.
func logLines(t *testing.T, buf *bytes.Buffer) []map[string]any {
	t.Helper()
	var lines []map[string]any
	dec := json.NewDecoder(buf)
	for dec.More() {
		var line map[string]any
		if err := dec.Decode(&line); err != nil {
			t.Fatalf("decode log line: %v", err)
		}
		lines = append(lines, line)
	}
	return lines
}

// RNF-07: each request has an identifier, and the identifier is in all the
// log lines of that request.
func TestRequestLog(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(httpx.NewLogHandler(slog.NewJSONHandler(&buf, nil)))
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		logger.InfoContext(r.Context(), "inside handler")
		w.WriteHeader(http.StatusTeapot)
	})
	handler := httpx.RequestLog(logger)(inner)

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/v1/anything", nil))

	id := rec.Header().Get(httpx.RequestIDHeader)
	if id == "" {
		t.Fatalf("response has no %s header", httpx.RequestIDHeader)
	}
	lines := logLines(t, &buf)
	if len(lines) != 2 {
		t.Fatalf("got %d log lines, want 2: %v", len(lines), lines)
	}
	for _, line := range lines {
		if line["request_id"] != id {
			t.Errorf("log line %q has request_id %v, want %q", line["msg"], line["request_id"], id)
		}
	}
	access := lines[1]
	if access["method"] != http.MethodGet || access["path"] != "/v1/anything" || access["status"] != float64(http.StatusTeapot) {
		t.Errorf("access log line = %v, want method GET, path /v1/anything, status 418", access)
	}
}

func TestRequestLogGivesEachRequestADifferentID(t *testing.T) {
	logger := slog.New(slog.DiscardHandler)
	handler := httpx.RequestLog(logger)(http.NotFoundHandler())

	first, second := httptest.NewRecorder(), httptest.NewRecorder()
	handler.ServeHTTP(first, httptest.NewRequest(http.MethodGet, "/", nil))
	handler.ServeHTTP(second, httptest.NewRequest(http.MethodGet, "/", nil))

	a, b := first.Header().Get(httpx.RequestIDHeader), second.Header().Get(httpx.RequestIDHeader)
	if a == "" || a == b {
		t.Errorf("request ids = %q and %q, want two different values", a, b)
	}
}

// ADR 0032, item 4: the log lines of a request have the trace_id of its span,
// and the span has the name of the route, not the path with the identifiers.
func TestRequestLogLinksTheLogToTheTrace(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(httpx.NewLogHandler(slog.NewJSONHandler(&buf, nil)))
	recorder := tracetest.NewSpanRecorder()
	provider := sdktrace.NewTracerProvider(sdktrace.WithSpanProcessor(recorder))
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/pets/{petId}", func(w http.ResponseWriter, r *http.Request) {
		logger.InfoContext(r.Context(), "inside handler")
	})
	handler := otelhttp.NewHandler(httpx.RequestLog(logger)(mux), "http", otelhttp.WithTracerProvider(provider))

	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/v1/pets/0193", nil))

	spans := recorder.Ended()
	if len(spans) != 1 {
		t.Fatalf("got %d spans, want 1", len(spans))
	}
	if got := spans[0].Name(); got != "GET /v1/pets/{petId}" {
		t.Errorf("span name = %q, want GET /v1/pets/{petId}", got)
	}
	traceID := spans[0].SpanContext().TraceID().String()
	for _, line := range logLines(t, &buf) {
		if line["trace_id"] != traceID {
			t.Errorf("log line %q has trace_id %v, want %s", line["msg"], line["trace_id"], traceID)
		}
	}
}

// #303: the HTTP metrics have the route, as "/v1/pets/{petId}", so Grafana
// shows the latency and the errors of each endpoint.
func TestRequestLogPutsTheRouteInTheMetrics(t *testing.T) {
	reader := sdkmetric.NewManualReader()
	provider := sdkmetric.NewMeterProvider(sdkmetric.WithReader(reader))
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/pets/{petId}", func(w http.ResponseWriter, r *http.Request) {})
	logger := slog.New(slog.DiscardHandler)
	handler := otelhttp.NewHandler(httpx.RequestLog(logger)(mux), "http", otelhttp.WithMeterProvider(provider))

	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/v1/pets/0193", nil))

	var metrics metricdata.ResourceMetrics
	if err := reader.Collect(t.Context(), &metrics); err != nil {
		t.Fatalf("collect: %v", err)
	}
	for _, scope := range metrics.ScopeMetrics {
		for _, metric := range scope.Metrics {
			if metric.Name != "http.server.request.duration" {
				continue
			}
			histogram := metric.Data.(metricdata.Histogram[float64])
			for _, point := range histogram.DataPoints {
				if route, ok := point.Attributes.Value("http.route"); ok && route.AsString() == "/v1/pets/{petId}" {
					return
				}
			}
			t.Fatalf("http.server.request.duration has no http.route /v1/pets/{petId}: %+v", histogram.DataPoints)
		}
	}
	t.Fatal("no http.server.request.duration metric")
}
