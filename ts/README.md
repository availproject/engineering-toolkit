# internal-utils

Structured logging and tracing for TypeScript services, built on OpenTelemetry.

## Run Example
```bash
bun run ./src/example.ts 
```

## Quick Start

```typescript
import { TracingBuilder } from 'internal-utils';

const { logger, shutdown } = await new TracingBuilder()
  .withJson(false)
  .build();

logger.info("App started", { version: "1.0.0" });

await shutdown();
```

## Initialization

`TracingBuilder` configures the OpenTelemetry SDK and returns a logger and shutdown function.

```typescript
import { TracingBuilder } from 'internal-utils';

const { logger, shutdown } = await new TracingBuilder()
  .withJson(false)           // pretty output (colored). true = JSON lines (default)
  .withOtel({
    serviceName: 'my-service',
    serviceVersion: '1.0.0',
    endpointTraces: 'http://localhost:4318/v1/traces',
    endpointMetrics: 'http://localhost:4318/v1/metrics',
    endpointLogs: 'http://localhost:4318/v1/logs',
  })
  .build();
```

Logs always print to the console. When OTLP endpoints are configured, logs/traces/metrics are also exported to your collector.

## Logging

Six levels: `trace`, `debug`, `info`, `warn`, `error`, `fatal`. Second argument is structured fields.

```typescript
logger.info("User logged in", { userId: 123, action: "login" });
logger.error("Connection lost", { host: "db.internal", retries: 3 });
```

### Child Loggers

`child()` creates a new logger that merges persistent fields into every log.

```typescript
const reqLogger = logger.child({ requestId: "abc-123", userId: "user-42" });
reqLogger.info("Handling request");     // includes requestId + userId
reqLogger.warn("Slow query", { ms: 480 }); // includes requestId + userId + ms
```

### Global Logger Access

`getLogger(name)` works from any module after `build()` has been called. Before init, it returns a no-op logger (safe to call, does nothing).

```typescript
import { getLogger } from 'internal-utils';

const logger = getLogger('payments');
logger.info("Payment processed", { amount: 99.99 });
```

## Tracing

### withSpan

Wraps an async operation in a span. Automatically ends the span, records exceptions, and sets error status. Logs inside the callback carry `trace_id` and `span_id`.

```typescript
import { withSpan } from 'internal-utils';

await withSpan("order.process", async (span) => {
  span.setAttribute("orderId", "ord-123");
  await processOrder();
});
```

With options (`SpanKind`, initial attributes, custom tracer name):

```typescript
import { SpanKind } from '@opentelemetry/api';

await withSpan("db.query", {
  kind: SpanKind.CLIENT,
  attributes: { "db.system": "postgres" },
}, async () => {
  await db.query(sql);
});
```

### withSpanSync

Same as `withSpan` but for synchronous work.

```typescript
import { withSpanSync } from 'internal-utils';

const isValid = withSpanSync("validate.input", () => {
  return input.length > 0;
});
```

### Error Handling

Exceptions thrown inside `withSpan`/`withSpanSync` are recorded on the span, the span status is set to `ERROR`, and the error is re-thrown.

```typescript
try {
  await withSpan("order.charge", async () => {
    throw new Error("Payment declined");
  });
} catch (err) {
  logger.error("Charge failed");
}
```

### Nested Spans

Spans nest automatically via context propagation.

```typescript
await withSpan("http.request", async () => {
  // parent span

  await withSpan("auth.validate", async () => {
    // child span
  });

  await withSpan("db.insert", async () => {
    // child span
  });
});
```

## Metrics

`createMetrics(name)` returns a `Metrics` instance for creating instruments.

```typescript
import { createMetrics } from 'internal-utils';

const m = createMetrics('my-service');
```

### Counter

Values that only go up (requests, errors, orders).

```typescript
const orderCount = m.counter("orders.total");
orderCount.add(1, { type: "new" });
```

### UpDownCounter

Values that go up and down (active connections, queue size).

```typescript
const activeJobs = m.upDownCounter("jobs.active");
activeJobs.add(1);   // job started
activeJobs.add(-1);  // job finished
```

### Histogram

Distributions (latency, request size).

```typescript
const duration = m.histogram("http.request.duration", { unit: "ms" });
duration.record(45.2, { method: "GET", route: "/orders" });
```

Histograms have a `.time()` helper that measures duration automatically:

```typescript
// Async — records elapsed time in ms
await duration.time({ method: "POST", route: "/orders" }, async () => {
  await processOrder();
});

// Without attributes
const result = await duration.time(async () => {
  return await db.query(sql);
});

// Sync
const parsed = duration.timeSync(() => JSON.parse(data));
```

### Gauge

Observes a value via callback at export time.

```typescript
m.gauge("queue.size", () => queue.length);
```

### Raw Meter Access

For advanced use cases, access the underlying OTel meter directly.

```typescript
import { getMeter } from 'internal-utils';

const meter = getMeter('my-service');
const counter = meter.createCounter('custom_metric');
```

## Output Formats

**JSON** (`withJson(true)`, default):
```
{"timestamp":"2026-02-20T10:30:00.000Z","level":"INFO","message":"App started","version":"1.0.0"}
```

**Pretty** (`withJson(false)`):
```
2026-02-20T10:30:00.000Z  INFO   App started  version=1.0.0
```

Pretty mode uses colored severity levels: TRACE (magenta), DEBUG (blue), INFO (green), WARN (yellow), ERROR/FATAL (red).

## Example

See [`src/example.ts`](src/example.ts) for a runnable showcase of all features:

```bash
npx tsx src/example.ts
```

## API Reference

### TracingBuilder

| Method | Description |
|--------|-------------|
| `.withJson(enabled)` | `true` = JSON lines (default), `false` = colored pretty output |
| `.withOtel(params)` | Configure OTLP endpoints and service identity |
| `.build()` | Start the SDK, returns `{ logger, shutdown }` |

### OtelParams

| Field | Description |
|-------|-------------|
| `serviceName` | Service name for the logger and resource |
| `serviceVersion` | Service version |
| `endpointTraces` | OTLP traces endpoint URL |
| `endpointMetrics` | OTLP metrics endpoint URL |
| `endpointLogs` | OTLP logs endpoint URL |

### Logger

| Method | Description |
|--------|-------------|
| `.trace(message, fields?)` | Log at TRACE level |
| `.debug(message, fields?)` | Log at DEBUG level |
| `.info(message, fields?)` | Log at INFO level |
| `.warn(message, fields?)` | Log at WARN level |
| `.error(message, fields?)` | Log at ERROR level |
| `.fatal(message, fields?)` | Log at FATAL level |
| `.child(fields)` | Create child logger with persistent fields |

### Metrics

| Method | Description |
|--------|-------------|
| `.counter(name, options?)` | Create a counter (monotonically increasing) |
| `.histogram(name, options?)` | Create a `TimedHistogram` (distributions + `.time()` helper) |
| `.upDownCounter(name, options?)` | Create an up-down counter |
| `.gauge(name, callback, options?)` | Create an observable gauge |

### TimedHistogram

| Method | Description |
|--------|-------------|
| `.record(value, attrs?)` | Record a value manually |
| `.time([attrs], fn)` | Run async function, record elapsed ms |
| `.timeSync([attrs], fn)` | Run sync function, record elapsed ms |

### Functions

| Function | Description |
|----------|-------------|
| `getLogger(name)` | Get a named logger (works after `build()`) |
| `createMetrics(name)` | Create a `Metrics` instance bound to a meter |
| `getTracer(name)` | Get an OpenTelemetry tracer |
| `getMeter(name)` | Get an OpenTelemetry meter (raw access) |
| `withSpan(name, [options], fn)` | Run async function inside a traced span |
| `withSpanSync(name, [options], fn)` | Run sync function inside a traced span |

### TraceOptions

Extends OpenTelemetry `SpanOptions` with:

| Field | Description |
|-------|-------------|
| `tracer` | Custom tracer name (default: `"app"`) |
| `kind` | `SpanKind.SERVER`, `CLIENT`, `INTERNAL`, etc. |
| `attributes` | Initial span attributes |
