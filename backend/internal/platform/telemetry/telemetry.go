// Package telemetry starts the export of the traces and the metrics of the
// API by OTLP over HTTP (ADR 0032).
package telemetry

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/propagation"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
)

// _serviceName is the name of the API in Tempo, Prometheus and Grafana.
const _serviceName = "nupii-api"

// Start sets the global tracer and meter providers of otel to export to the
// collector at endpoint, as "http://alloy:4318". With an empty endpoint, Start
// does nothing: the providers stay the no-op providers (ADR 0032, item 3).
//
// The caller calls the returned function when the API stops. It sends the
// spans and the metrics that wait, and stops the export; its context limits
// the time it has.
func Start(ctx context.Context, endpoint string) (func(context.Context) error, error) {
	if endpoint == "" {
		return func(context.Context) error { return nil }, nil
	}
	base := strings.TrimSuffix(endpoint, "/")
	spans, err := otlptracehttp.New(ctx, otlptracehttp.WithEndpointURL(base+"/v1/traces"))
	if err != nil {
		return nil, fmt.Errorf("create the trace exporter: %w", err)
	}
	metrics, err := otlpmetrichttp.New(ctx, otlpmetrichttp.WithEndpointURL(base+"/v1/metrics"))
	if err != nil {
		return nil, fmt.Errorf("create the metric exporter: %w", err)
	}
	service, err := resource.Merge(resource.Default(),
		resource.NewSchemaless(attribute.String("service.name", _serviceName)))
	if err != nil {
		return nil, fmt.Errorf("create the resource: %w", err)
	}

	// The batch processor sends the spans in the background: a request does
	// not wait for the collector, and a failure of the collector loses only
	// telemetry (ADR 0032, consequences).
	tracerProvider := sdktrace.NewTracerProvider(sdktrace.WithBatcher(spans), sdktrace.WithResource(service))
	meterProvider := sdkmetric.NewMeterProvider(
		sdkmetric.WithReader(sdkmetric.NewPeriodicReader(metrics)), sdkmetric.WithResource(service))
	otel.SetTracerProvider(tracerProvider)
	otel.SetMeterProvider(meterProvider)
	// The calls to the inference service carry the trace (traceparent).
	otel.SetTextMapPropagator(propagation.TraceContext{})

	return func(ctx context.Context) error {
		return errors.Join(tracerProvider.Shutdown(ctx), meterProvider.Shutdown(ctx))
	}, nil
}
