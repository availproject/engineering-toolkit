# internal-utils (Rust)

Rust observability helpers built around `tracing` and OpenTelemetry.

The crate provides a small setup layer for structured logging, OTLP export, common metrics helpers, optional SQLx helpers, and optional OpenAPI support.

## Features

Default features: `otel`, `db`, `openapi`

| Feature | Description |
| --- | --- |
| `otel` | OpenTelemetry traces, metrics, and logs via OTLP HTTP exporters |
| `db` | Postgres pool initialization via `sqlx` |
| `openapi` | OpenAPI helpers via `utoipa` and `utoipa-axum` |

Build examples:

```bash
cargo build --manifest-path rust/Cargo.toml
cargo build --manifest-path rust/Cargo.toml --no-default-features
cargo build --manifest-path rust/Cargo.toml --no-default-features --features "otel,db"
```

## Quick Start

```rust
use internal_utils::{OtelParams, TracingBuilder, info};

fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let _guards = TracingBuilder::new()
        .with_rust_log("info")
        .with_json(Some(false))
        .with_otel(OtelParams::default())
        .try_init()?;

    info!(service = "example", "service started");
    Ok(())
}
```

Keep the returned guards alive for the lifetime of the process so traces, metrics, and logs can flush on shutdown.

## Core API

### TracingBuilder

`TracingBuilder` configures stdout logging, optional file output, env filtering, and OpenTelemetry exporters.

Common builder methods:
- `.with_stdout(bool)`
- `.with_json(Option<bool>)`
- `.with_file(Option<String>)`
- `.with_predefined_file()`
- `.with_env_filter(Option<EnvFilter>)`
- `.with_rust_log(&str)`
- `.with_otel(OtelParams)`
- `.try_init()`

### OtelParams

`OtelParams` controls OTLP endpoints and service identity.

```rust
use internal_utils::OtelParams;

let params = OtelParams {
    endpoint_traces: Some("http://localhost:4318/v1/traces".into()),
    endpoint_metrics: Some("http://localhost:4318/v1/metrics".into()),
    endpoint_logs: Some("http://localhost:4318/v1/logs".into()),
    service_name: "order-service".into(),
    service_version: "1.0.0".into(),
};
```

### Logging Re-exports

The crate re-exports the `tracing` macros, so you can write:

```rust
use internal_utils::{debug, error, info, trace, warn};

info!(request_id = "req-123", "request accepted");
warn!(component = "billing", "slow downstream");
```

### Database Helper

When the `db` feature is enabled, use `Db::initialize()` to create a Postgres pool.

```rust
let pool = internal_utils::Db::initialize(
    "postgres://user:pass@localhost/app",
    Some(10),
)
.await?;
```

### Metrics Helpers

The crate exposes reusable meter helpers and attribute builders.

```rust
use internal_utils::{HttpRequestMetrics, IntoOtelAttributes, MetricsHelper, otel_meter};

let meter = otel_meter("order-service");
let counter = MetricsHelper::http_request_counter(&meter);

let attrs = HttpRequestMetrics::new()
    .post()
    .route("/orders")
    .status_code(201)
    .duration(42)
    .into_attributes();

counter.add(1, &attrs);
```

## Re-exports

Depending on enabled features, the crate re-exports:
- `tracing`
- `tracing_subscriber`
- `opentelemetry`, `opentelemetry_otlp`, `opentelemetry_sdk`, `opentelemetry_semantic_conventions`
- `sqlx`
- `utoipa`, `utoipa_axum`

## Examples

Run from the repository root:

```bash
cargo run --manifest-path rust/Cargo.toml --example tracing_example
cargo run --manifest-path rust/Cargo.toml --example openapi
```

Included examples:
- `rust/examples/tracing_example.rs` - end-to-end tracing, logging, and metrics flow
- `rust/examples/openapi.rs` - generates an OpenAPI document with `utoipa-axum`

## Local OTLP Backend

Examples are easiest to inspect with SigNoz running locally.

```bash
git clone https://github.com/SigNoz/signoz.git
cd signoz/deploy/docker/clickhouse-setup
docker compose up -d
# Open http://localhost:8080/
```

Default OTLP endpoints:
- `http://localhost:4318/v1/traces`
- `http://localhost:4318/v1/metrics`
- `http://localhost:4318/v1/logs`

Stop SigNoz:

```bash
docker compose down -v
```

## Development

Useful commands:

```bash
cargo test --manifest-path rust/Cargo.toml
bash rust/check_build.sh
```

`rust/check_build.sh` verifies a few important feature combinations:
- no default features
- `otel`
- `otel, openapi`
- `openapi`
