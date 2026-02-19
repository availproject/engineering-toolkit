# Engineering Toolkit

Internal utilities for observability: logging, tracing, and metrics with OpenTelemetry integration.

## Structure

```
engineering-toolkit/
├── rust/
│   └── crates/
│       └── internal-utils    # Rust crate
└── ts/
    └── internal-utils        # TypeScript package
```

## Packages

### Rust (`rust/crates/internal-utils`)

Tracing and metrics utilities built on the `tracing` ecosystem.

**Features:**
- `otel` — OpenTelemetry integration (traces, metrics, logs)
- `db` — Database utilities (sqlx/Postgres)
- `openapi` — OpenAPI/Swagger support (utoipa)

```toml
[dependencies]
internal-utils = { path = "../engineering-toolkit/rust/crates/internal-utils" }
```

### TypeScript (`ts/`)

Logging and tracing utilities built on Pino + OpenTelemetry.

**Features:**
- Structured logging with Pino
- OpenTelemetry traces, metrics, and logs export
- Auto-instrumentation for HTTP and Postgres

```json
"dependencies": {
  "internal-utils": "github:availproject/engineering-toolkit#main&path:ts"
}
```

## Local Development

### OpenTelemetry Backend (SigNoz)

```bash
git clone https://github.com/SigNoz/signoz.git
cd signoz/deploy/docker/clickhouse-setup
docker compose up -d
# Open http://localhost:8080/
```

Default OTLP endpoints:
- Traces: `http://localhost:4318/v1/traces`
- Metrics: `http://localhost:4318/v1/metrics`
- Logs: `http://localhost:4318/v1/logs`

Stop containers:
```bash
docker compose down -v
```
