# Tracing Libraries Improvement Plan

## Executive Summary

Both Rust and TypeScript tracing libraries work but lack ergonomics that would make developers love using them. This document outlines improvements to reduce boilerplate, add missing features, and create a delightful developer experience.

## Current Pain Points

### Critical Issues (Both Libraries)

| Issue | Impact | Priority |
|-------|--------|----------|
| Manual span management | 20+ lines of boilerplate per operation | P0 |
| No automatic error recording | Easy to forget, inconsistent traces | P0 |
| No span helper utilities | Verbose try/finally patterns | P0 |
| Hardcoded 100ms shutdown timeout | May lose telemetry | P1 |
| No sampling configuration | Cost explosion at scale | P1 |
| No resource attributes | Limited context in backends | P1 |

### TypeScript Specific

| Issue | Impact | Priority |
|-------|--------|----------|
| No decorator for auto-instrumentation | Rust has `#[instrument]`, TS has nothing | P0 |
| No context propagation helpers | Lost traces in async chains | P0 |
| No semantic naming (otel.name) | Inconsistent operation names | P1 |
| No log rotation | Disk exhaustion risk | P1 |

### Rust Specific

| Issue | Impact | Priority |
|-------|--------|----------|
| Unsafe env var manipulation | UB in multi-threaded code | P0 |
| Blocking file I/O | Latency spikes | P1 |
| Silent OTEL failures | Hard to debug | P1 |

---

## Proposed API Improvements

### 1. Span Helper Utilities (Both)

**Current (verbose):**
```typescript
const tracer = getTracer('service');
const span = tracer.startSpan('operation');
try {
  span.setAttribute('key', 'value');
  const result = await doWork();
  span.setStatus({ code: SpanStatusCode.OK });
  return result;
} catch (error) {
  span.recordException(error);
  span.setStatus({ code: SpanStatusCode.ERROR });
  throw error;
} finally {
  span.end();
}
```

**Proposed (ergonomic):**
```typescript
// TypeScript
const result = await withSpan('operation', { key: 'value' }, async (span) => {
  return await doWork();
});

// Or even simpler for basic cases
const result = await traced('operation', () => doWork());
```

```rust
// Rust - already has #[instrument], but add runtime helper
let result = with_span("operation", |span| {
    span.set_attribute("key", "value");
    do_work()
}).await;
```

### 2. TypeScript Decorator (P0)

**Proposed API:**
```typescript
@traced('http.request')
async function handleRequest(req: Request): Promise<Response> {
  // Automatic span creation, error handling, context propagation
}

@traced({ name: 'db.query', attributes: { 'db.system': 'postgresql' } })
async function queryDatabase(sql: string): Promise<Result> {
  // Automatic span with custom attributes
}

// With attribute extraction from arguments
@traced('user.create', { extractAttributes: (user) => ({ 'user.id': user.id }) })
async function createUser(user: User): Promise<void> {
  // Span automatically includes user.id attribute
}
```

### 3. Context-Aware Logger (Both)

**Current:**
```typescript
logger.info({ orderId }, 'Order created');
// No link to current span, no trace context
```

**Proposed:**
```typescript
// Automatic trace context injection
const log = createContextLogger(logger);
log.info('Order created', { orderId });
// Automatically includes: trace_id, span_id, otel.name

// Or with semantic naming
log.event('order.create.success', { orderId });
// Creates span event + log with otel.name field
```

### 4. Configurable Builder (Both)

**Proposed additions:**
```typescript
TracingBuilder.create()
  .withLogLevel('info')
  .withOtel({
    serviceName: 'my-service',
    serviceVersion: '1.0.0',
    // NEW: Resource attributes
    resourceAttributes: {
      'deployment.environment': 'production',
      'service.namespace': 'payments',
      'k8s.pod.name': process.env.POD_NAME,
    },
    // NEW: Sampling configuration
    sampler: {
      type: 'parentBased',
      root: { type: 'traceIdRatio', ratio: 0.1 }, // 10% sampling
    },
    // NEW: Batch configuration
    batch: {
      maxQueueSize: 2048,
      scheduledDelayMs: 5000,
      maxExportBatchSize: 512,
    },
  })
  // NEW: Configurable shutdown
  .withShutdownTimeout(5000)
  // NEW: Log rotation
  .withFile('./logs/app.log', {
    rotation: 'daily',
    maxFiles: 7,
    compress: true,
  })
  .init();
```

### 5. Metrics Helpers (Both)

**Proposed API:**
```typescript
// Pre-built metric utilities
const metrics = createMetricsHelper('my-service');

// HTTP metrics (auto-follows semantic conventions)
metrics.recordHttpRequest({
  method: 'POST',
  route: '/api/orders',
  statusCode: 201,
  durationMs: 45,
});

// Database metrics
metrics.recordDbQuery({
  system: 'postgresql',
  operation: 'SELECT',
  durationMs: 12,
  success: true,
});

// Custom metrics with builder
metrics.counter('orders_total')
  .add(1, { status: 'completed', region: 'us-east' });

metrics.histogram('order_value')
  .record(99.99, { currency: 'USD' });
```

### 6. Error Recording Helpers (Both)

**Proposed API:**
```typescript
// Automatic error recording with stack trace
function recordError(span: Span, error: Error, attributes?: Record<string, unknown>): void;

// Or as span method extension
span.recordError(error, { 'error.category': 'validation' });

// Auto-categorized errors
span.recordError(error); // Automatically sets:
// - error.type: 'ValidationError'
// - error.message: '...'
// - error.stack: '...'
// - span status: ERROR
```

---

## Implementation Plan

### Phase 1: Core Ergonomics (Week 1)

#### TypeScript
1. Add `withSpan()` helper function
2. Add `traced()` simple wrapper
3. Add configurable shutdown timeout
4. Add resource attributes support

#### Rust  
1. Remove unsafe env var code (use typed config)
2. Add `with_span()` runtime helper
3. Add configurable shutdown timeout
4. Add resource attributes support

### Phase 2: Advanced Features (Week 2)

#### TypeScript
1. Implement `@traced` decorator
2. Add context-aware logger
3. Add semantic naming support (otel.name)
4. Add metrics helpers

#### Rust
1. Add non-blocking file I/O (tracing-appender)
2. Add log rotation
3. Add metrics helpers
4. Add OTEL error logging (not silent)

### Phase 3: Production Hardening (Week 3)

#### Both
1. Add sampling configuration
2. Add batch configuration
3. Add comprehensive tests
4. Add documentation and examples

---

## API Reference (Proposed)

### TypeScript

```typescript
// Core exports
export { TracingBuilder } from './builder';
export { withSpan, traced } from './span-helpers';
export { createMetricsHelper } from './metrics-helpers';
export { createContextLogger } from './context-logger';
export { traced as Traced } from './decorators'; // Decorator

// Types
export interface SpanOptions {
  name: string;
  kind?: SpanKind;
  attributes?: Record<string, AttributeValue>;
}

export interface TracedOptions {
  name?: string;
  kind?: SpanKind;
  attributes?: Record<string, AttributeValue>;
  extractAttributes?: (...args: unknown[]) => Record<string, AttributeValue>;
  recordArgs?: boolean;
  recordResult?: boolean;
}

// Helper functions
export function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>
): Promise<T>;

export function withSpan<T>(
  name: string,
  attributes: Record<string, AttributeValue>,
  fn: (span: Span) => Promise<T>
): Promise<T>;

export function traced<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T>;
```

### Rust

```rust
// Core exports
pub use tracing::{info, warn, error, debug, trace, info_span, warn_span, error_span};
pub use TracingBuilder;
pub use TracingGuards;
pub use TracingConfig; // NEW: typed config

// Helper functions
pub async fn with_span<F, T>(name: &str, f: F) -> T
where
    F: Future<Output = T>;

pub async fn with_span_attrs<F, T>(
    name: &str, 
    attrs: &[(&str, &dyn std::fmt::Display)],
    f: F
) -> T
where
    F: Future<Output = T>;

// Metrics helpers
pub fn http_request_counter(service: &str) -> Counter<u64>;
pub fn http_request_duration(service: &str) -> Histogram<f64>;
```

---

## Success Metrics

After implementation, developers should be able to:

1. **Instrument a function in 1 line** (decorator/attribute)
2. **Record errors automatically** (no manual try/catch for tracing)
3. **Propagate context automatically** (async chains just work)
4. **Configure sampling** (cost control at scale)
5. **Customize resource attributes** (environment, pod, region)
6. **Use semantic conventions easily** (helpers follow OTEL standards)

## Comparison: Before vs After

### Before (Current)
```typescript
async function createOrder(request: CreateOrderRequest): Promise<Order> {
  const tracer = getTracer('order-service');
  const span = tracer.startSpan('order.create', {
    kind: SpanKind.INTERNAL,
    attributes: {
      'order.user_id': request.userId,
    },
  });
  
  try {
    const order = await orderRepository.create(request);
    span.setAttribute('order.id', order.id);
    span.setStatus({ code: SpanStatusCode.OK });
    logger.info({ orderId: order.id }, 'Order created');
    return order;
  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({ code: SpanStatusCode.ERROR });
    logger.error({ error }, 'Failed to create order');
    throw error;
  } finally {
    span.end();
  }
}
```

### After (Proposed)
```typescript
@traced('order.create', { 
  extractAttributes: (req) => ({ 'order.user_id': req.userId }) 
})
async function createOrder(request: CreateOrderRequest): Promise<Order> {
  const order = await orderRepository.create(request);
  Span.current().setAttribute('order.id', order.id);
  log.event('order.create.success', { orderId: order.id });
  return order;
}
```

**Reduction: 25 lines → 7 lines (72% less code)**

---

## Open Questions

1. Should `@traced` decorator support synchronous functions?
2. Should we add Express/Fastify middleware out of the box?
3. Should sampling be per-span or global only?
4. Should we support multiple OTEL backends (Jaeger, Zipkin native)?

## Next Steps

1. Review and approve this plan
2. Create GitHub issues for each phase
3. Implement Phase 1 (Core Ergonomics)
4. Get feedback from early adopters
5. Iterate and complete Phase 2-3
