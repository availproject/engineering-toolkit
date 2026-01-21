# Internal Utils (TypeScript)

A collection of utilities for logging, tracing, database operations, and validation. Mirrors the Rust `internal-utils` crate API where applicable.

## Installation

```bash
npm install internal-utils
```

## Quick Start

```typescript
import { TracingBuilder, Db, z, schemas } from 'internal-utils';

// Initialize tracing
const { logger, shutdown } = await TracingBuilder.create()
  .withLogLevel('info')
  .withFormat('json')
  .init();

logger.info({ userId: 123 }, 'Application started');

// Cleanup on exit
process.on('beforeExit', shutdown);
```

## Features

- **Tracing & Logging**: Pino-based structured logging with OpenTelemetry integration
- **Database**: PostgreSQL connection pooling with health checks and transactions
- **Validation**: Zod-based schema validation with common helpers

## Tracing & Logging

### Basic Usage

```typescript
import { TracingBuilder } from 'internal-utils';

const { logger, shutdown } = await TracingBuilder.create()
  .withLogLevel('info')      // trace, debug, info, warn, error, fatal
  .withFormat('pretty')      // pretty for dev, json for production
  .withFile('./app.log')     // optional file output
  .init();

// Structured logging
logger.info({ userId: 123, action: 'login' }, 'User logged in');
logger.warn({ latencyMs: 500 }, 'Slow response detected');
logger.error({ err: new Error('Failed') }, 'Operation failed');

// Child loggers with context
const requestLogger = logger.child({ requestId: 'abc-123' });
requestLogger.info('Processing request');

// Graceful shutdown
await shutdown();
```

### OpenTelemetry Integration

```typescript
import { TracingBuilder, getMeter, getTracer } from 'internal-utils';

const { logger, shutdown } = await TracingBuilder.create()
  .withLogLevel('info')
  .withJson(true)
  .withOtel({
    serviceName: 'my-service',
    serviceVersion: '1.0.0',
    endpointTraces: 'http://localhost:4318/v1/traces',
    endpointMetrics: 'http://localhost:4318/v1/metrics',
    endpointLogs: 'http://localhost:4318/v1/logs',
  })
  .withOtelMetricExportInterval(10000) // 10 seconds
  .init();

// Custom metrics
const meter = getMeter('my-service');
const requestCounter = meter.createCounter('http_requests_total');
requestCounter.add(1, { method: 'GET', status: '200' });

// Custom spans
const tracer = getTracer('my-service');
const span = tracer.startSpan('process-order');
try {
  // ... do work
} finally {
  span.end();
}
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | Log level (trace/debug/info/warn/error/fatal) | `info` |
| `LOG_FORMAT` | Output format (json/pretty) | `json` (or `pretty` in development) |
| `RUST_LOG` | Alternative to LOG_LEVEL (for compatibility) | - |
| `OTEL_METRIC_EXPORT_INTERVAL` | Metric export interval in ms | `60000` |

## Database

### Basic Usage

```typescript
import { Db } from 'internal-utils';

// Initialize from config
const db = await Db.initialize({
  connectionString: 'postgres://user:pass@localhost:5432/mydb',
  maxConnections: 10,
});

// Or from environment variable (DATABASE_URL)
const db = await Db.initializeFromEnv();

// Execute queries
const result = await db.query<{ id: string; name: string }>(
  'SELECT * FROM users WHERE id = $1',
  [userId]
);

// Transactions
const newUser = await db.transaction(async (client) => {
  const result = await client.query(
    'INSERT INTO users (name) VALUES ($1) RETURNING *',
    ['Alice']
  );
  await client.query(
    'INSERT INTO audit_log (action) VALUES ($1)',
    ['user_created']
  );
  return result.rows[0];
});

// Health check
const health = await db.healthCheck();
console.log(health.healthy, health.latencyMs, health.pool);

// Cleanup
await db.close();
```

### With Drizzle ORM

```typescript
import { Db } from 'internal-utils';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

const client = await Db.initialize({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(client.pool, { schema });

// Use Drizzle's query builder
const users = await db.select().from(schema.users);
```

## Validation

### Basic Usage

```typescript
import { z, schemas, validate, safeValidate } from 'internal-utils';

// Define schemas
const UserSchema = z.object({
  id: schemas.uuid(),
  email: schemas.email(),
  name: schemas.nonEmptyString(100),
  createdAt: schemas.datetime(),
});

type User = z.infer<typeof UserSchema>;

// Validate (throws on error)
const user = validate(UserSchema, data);

// Safe validation (returns result object)
const result = safeValidate(UserSchema, data);
if (result.success) {
  console.log(result.data);
} else {
  console.log(result.error.issues);
}
```

### Common Schemas

```typescript
import { schemas } from 'internal-utils';

// String types
schemas.uuid()           // UUID v4
schemas.email()          // Email address
schemas.url()            // Valid URL
schemas.slug()           // URL-friendly slug
schemas.semver()         // Semantic version
schemas.ip()             // IPv4 or IPv6
schemas.nonEmptyString() // Non-empty string

// Date/time
schemas.datetime()       // ISO 8601 datetime
schemas.date()           // YYYY-MM-DD date

// Numbers
schemas.positiveInt()    // Positive integer
schemas.nonNegativeInt() // Non-negative integer
schemas.coercedNumber()  // String to number coercion

// API helpers
schemas.pagination({ defaultLimit: 20, maxLimit: 100 })
schemas.sortOrder()      // 'asc' | 'desc'
schemas.environment()    // development | staging | production | test

// HTTP response (matches tracing-explained.md structure)
schemas.httpResponseStatus()
```

### Error Formatting

```typescript
import { safeValidate, formatValidationErrors, flattenValidationErrors } from 'internal-utils';

const result = safeValidate(UserSchema, invalidData);

if (!result.success) {
  // Object format: { "email": ["Invalid email"], "name": ["Required"] }
  const errors = formatValidationErrors(result.error);

  // Array format: ["email: Invalid email", "name: Required"]
  const messages = flattenValidationErrors(result.error);
}
```

## Testing with SigNoz

Start SigNoz for local OpenTelemetry testing:

```bash
git clone https://github.com/SigNoz/signoz.git
cd signoz/deploy/docker/clickhouse-setup
docker compose up -d
# Open http://localhost:8080/
```

Stop containers:

```bash
docker rm -f $(docker ps -aq)
```

## API Reference

### TracingBuilder

| Method | Description |
|--------|-------------|
| `.create()` | Create a new builder instance |
| `.withLogLevel(level)` | Set log level |
| `.withFormat(format)` | Set output format (json/pretty) |
| `.withJson(enabled)` | Shorthand for format |
| `.withStdout(enabled)` | Enable/disable stdout |
| `.withFile(path, json?)` | Enable file output |
| `.withDefaultFile()` | File output to ./log.txt |
| `.withOtel(params)` | Configure OpenTelemetry |
| `.withOtelMetricExportInterval(ms)` | Set metric export interval |
| `.init()` | Initialize and return guards |

### Db

| Method | Description |
|--------|-------------|
| `Db.initialize(config)` | Create pool from config |
| `Db.initializeFromEnv(max?)` | Create pool from DATABASE_URL |
| `Db.connect(url, max?)` | Shorthand for initialize |
| `db.query(sql, params)` | Execute a query |
| `db.transaction(fn, opts?)` | Execute in transaction |
| `db.healthCheck()` | Check database health |
| `db.close()` | Close all connections |

## License

MIT
