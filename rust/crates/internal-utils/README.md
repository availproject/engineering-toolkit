## For OTEL
Run SigNoz

```bash
git clone https://github.com/SigNoz/signoz.git
cd signoz/deploy/docker/clickhouse-setup
docker compose up -d
# Open http://localhost:8080/
```

To stop all containers
```bash
docker rm -f $(docker ps -aq)
```

## Notes
TODOs
- Implement non-blocking tracing with tracing-appender

Libs used
- tracing: Structured, scoped logging and instrumentation framework for Rust. Provides spans, events, and macros (info!, error!, #[instrument]) used throughout the codebase.
- tracing-subscriber: Provides implementations of tracing subscribers and layers. Responsible for collecting spans/events and deciding where they go (console, file, OpenTelemetry, filtering by level, formatting, etc.).
- tracing-opentelemetry: Provides a tracing layer (subscriber) that converts tracing spans into OpenTelemetry spans and forwards them to an OpenTelemetry tracer/exporter.
- opentelemetry: Defines the core OpenTelemetry API (traits and types such as Tracer, Span, Context, KeyValue). This crate provides the interfaces but does not implement exporting or storage.
- opentelemetry_sdk: Provides the actual OpenTelemetry implementation. Handles span creation, sampling, batching, resource configuration, and runtime integration.
- opentelemetry-otlp: Provides an OpenTelemetry exporter that sends traces to an OpenTelemetry Collector or compatible backend using the OTLP protocol (gRPC or HTTP).
- opentelemetry-semantic-conventions: Provides standardized attribute keys (e.g. service.name, http.method) defined by the OpenTelemetry specification to ensure consistent telemetry across tools and services.
- tracing-appender: Provides non-blocking and rolling file appenders for tracing output (e.g. daily log rotation).
