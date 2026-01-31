# Internal Utils (TypeScript)

Logging and tracing utilities with OpenTelemetry integration.

## Installation

```bash
npm install internal-utils
```

## Quick Start

```typescript
import { TracingBuilder } from 'internal-utils';

const { logger, shutdown } = await TracingBuilder.create()
  .withLogLevel('info')
  .withFormat('json')
  .init();

logger.info({ userId: 123 }, 'Application started');

process.on('beforeExit', shutdown);
```

## Basic Usage

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

## OpenTelemetry Integration

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

## Default Endpoints

When using `withOtel()`, endpoints default to:
- Traces: `http://localhost:4318/v1/traces`
- Metrics: `http://localhost:4318/v1/metrics`
- Logs: `http://localhost:4318/v1/logs`

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | Log level (trace/debug/info/warn/error/fatal) | `info` |
| `LOG_FORMAT` | Output format (json/pretty) | `json` (or `pretty` in development) |
| `OTEL_METRIC_EXPORT_INTERVAL` | Metric export interval in ms | `60000` |

## Testing with SigNoz

Start SigNoz for local OpenTelemetry testing:

```bash
git clone https://github.com/SigNoz/signoz.git
cd signoz/deploy/docker/clickhouse-setup
docker compose up -d
# Open http://localhost:8080/
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

### Helpers

| Function | Description |
|----------|-------------|
| `getMeter(name)` | Get OpenTelemetry meter for custom metrics |
| `getTracer(name)` | Get OpenTelemetry tracer for custom spans |
| `createSimpleLogger(level?)` | Create a simple synchronous logger |
| `createChildLogger(parent, bindings)` | Create child logger with context |

### Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `DEFAULT_ENDPOINTS.traces` | `http://localhost:4318/v1/traces` | Default OTLP traces endpoint |
| `DEFAULT_ENDPOINTS.metrics` | `http://localhost:4318/v1/metrics` | Default OTLP metrics endpoint |
| `DEFAULT_ENDPOINTS.logs` | `http://localhost:4318/v1/logs` | Default OTLP logs endpoint |
| `SHUTDOWN_TIMEOUT_MS` | `100` | Shutdown timeout in milliseconds |
