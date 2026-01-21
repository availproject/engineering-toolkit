# Engineering Toolkit

A collection of internal documentation, tools, and utilities for building production-grade services.

## Structure

### Docs
- **[Code Guidelines](docs/code-guidelines.md)** - Rust-specific and general coding guidelines
- **[GitHub Project Management](docs/github-project-management.md)** - GitHub workflow, issues, PRs, and releases
- **[OpenTelemetry Explained](docs/otel-explained.md)** - Metrics best practices and usage
- **[Tracing Explained](docs/tracing-explained.md)** - Logging and tracing conventions

### Tools

#### Rust (`tools/rust/`)
- **internal-utils** - Tracing/Logging with OpenTelemetry, Database utilities (PostgreSQL/sqlx)

#### TypeScript (`tools/ts/`)
- **internal-utils** - Mirrors the Rust crate functionality:
  - Tracing/Logging (Pino + OpenTelemetry)
  - Database utilities (PostgreSQL/pg with optional Drizzle ORM)
  - Validation (Zod schemas and helpers)

### Scripts
- TODO

## Quick Start

### TypeScript

```bash
cd tools/ts
npm install
npm run build
npm test
```

### Rust

```bash
cd tools/rust/crates/internal-utils
cargo build
cargo test
```

## Testing with OpenTelemetry

Both toolkits are designed to work with SigNoz for local OpenTelemetry testing:

```bash
git clone https://github.com/SigNoz/signoz.git
cd signoz/deploy/docker/clickhouse-setup
docker compose up -d
# Open http://localhost:8080/
```
Structure:
- Docs
    - Github Project Management
    - Otel Explained
    - Tracing Explained
    - Tracing Conventions
    - Code Guidelines
    - Patterns
        - Embedded DSL Pattern

- Tools
    - Rust
        - Internal Utils - Tracing/Logging
    - JS
        - Internal Utils - TODO
- Scripts
    - TODO
