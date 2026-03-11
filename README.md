# Engineering Toolkit

Internal observability utilities for Rust and TypeScript services.

This repo contains two language-specific packages that standardize logging, tracing, and metrics around OpenTelemetry, plus local examples for validating integrations against SigNoz or any OTLP-compatible backend.

## Repository Layout

```text
engineering-toolkit/
|-- rust/
|   |-- Cargo.toml
|   |-- README.md
|   |-- check_build.sh
|   |-- examples/
|   `-- src/
`-- ts/
    |-- package.json
    |-- README.md
    |-- src/
    `-- dist/
```

## Packages

| Package | Path | Purpose |
| --- | --- | --- |
| Rust `internal-utils` | `rust/` | `tracing`-based logging, OpenTelemetry export, SQLx helpers, OpenAPI helpers |
| TypeScript `internal-utils` | `ts/` | structured logging, span helpers, metrics helpers, OTLP export |

## Rust Package

Path: `rust/`

The Rust crate exposes tracing setup and optional integrations behind feature flags.

Features:
- `otel` - OpenTelemetry traces, metrics, and logs via OTLP
- `db` - Postgres helpers built on `sqlx`
- `openapi` - OpenAPI support via `utoipa` and `utoipa-axum`

Default features: `otel`, `db`, `openapi`

Useful entry points:
- `rust/src/lib.rs` - `TracingBuilder`, `OtelParams`, telemetry guards, re-exports
- `rust/src/metrics.rs` - metric helpers
- `rust/examples/tracing_example.rs` - end-to-end tracing and metrics example
- `rust/examples/openapi.rs` - OpenAPI generation example
- `rust/check_build.sh` - verifies important feature combinations

Common commands:

```bash
cargo build --manifest-path rust/Cargo.toml
bash rust/check_build.sh
cargo run --manifest-path rust/Cargo.toml --example tracing_example
cargo run --manifest-path rust/Cargo.toml --example openapi
```

More Rust-specific details live in `rust/README.md`.

## TypeScript Package

Path: `ts/`

The TypeScript package targets Node.js services and ships ESM builds plus type declarations.

Included capabilities:
- structured logging
- `TracingBuilder` for OpenTelemetry SDK setup
- `withSpan` and `withSpanSync` helpers
- metric helpers for counters, histograms, gauges, and timed measurements
- direct access to OTel tracers and meters when lower-level control is needed

Requirements:
- Node.js `>=20`

Useful entry points:
- `ts/src/index.ts` - main exports
- `ts/src/tracing/index.ts` - tracing helpers and public API surface
- `ts/src/example.ts` - feature walkthrough
- `ts/src/example-service.ts` - realistic service flow example

Common commands:

```bash
npm --prefix ts run build
npm --prefix ts run typecheck
npm --prefix ts test
npx tsx ts/src/example.ts
npx tsx ts/src/example-service.ts
```

More TypeScript-specific details live in `ts/README.md`.

## Local OpenTelemetry Backend

The examples assume a local OTLP-compatible backend. SigNoz is the easiest setup used in this repo.

```bash
git clone https://github.com/SigNoz/signoz.git
cd signoz/deploy/docker/clickhouse-setup
docker compose up -d
# Open http://localhost:8080/
```

Default OTLP HTTP endpoints:
- Traces: `http://localhost:4318/v1/traces`
- Metrics: `http://localhost:4318/v1/metrics`
- Logs: `http://localhost:4318/v1/logs`

Stop SigNoz:

```bash
docker compose down -v
```

## Development Notes

- The top-level repo is documentation and package source only; build commands run from `rust/` or `ts/`
- Rust examples use the crate in `rust/` directly
- TypeScript builds output to `ts/dist/`
- Long-form package docs live in `rust/README.md` and `ts/README.md`
