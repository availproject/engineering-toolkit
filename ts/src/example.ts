// Run: npx tsx src/example.ts
//
// API walkthrough — each section demonstrates one feature in isolation.
// For a realistic end-to-end example, see src/example-service.ts.

import { SpanKind } from "@opentelemetry/api";
import { TracingBuilder, getLogger, withSpan, withSpanSync, createMetrics } from "./index.js";

async function main() {
  // ── 1. Initialize ─────────────────────────────────────────────
  // build() starts the OTel SDK and returns a logger + shutdown fn.
  // withJson(false) = colored pretty output, withJson(true) = JSON lines (default).
  const { logger, shutdown } = await new TracingBuilder()
    .withJson(false)
    .withOtel({
      serviceName: "example-service",
      endpointTraces: "http://localhost:4318/v1/traces",
      endpointLogs: "http://localhost:4318/v1/logs",
      endpointMetrics: "http://localhost:4318/v1/metrics",
    })
    .build();

  // ── 2. Structured logging ─────────────────────────────────────
  // All levels: trace, debug, info, warn, error, fatal.
  // Second argument is structured fields (key-value pairs).
  logger.info("App started", { version: "1.0.0" });
  logger.warn("Disk usage high", { percent: 91 });
  logger.error("Connection lost", { host: "db.internal", retries: 3 });

  // ── 3. Child loggers ──────────────────────────────────────────
  // child() returns a new logger that merges persistent fields into every log.
  const reqLogger = logger.child({ requestId: "req-abc-123", userId: "user-42" });
  reqLogger.info("Handling request");
  reqLogger.warn("Slow upstream", { latencyMs: 480 });
  // Both logs above automatically include requestId and userId.

  // ── 4. Global logger access ───────────────────────────────────
  // getLogger(name) works from anywhere after build().
  // Useful in modules that don't have access to the root logger.
  const payments = getLogger("payments");
  payments.info("Payment processed", { amount: 99.99, currency: "USD" });

  // ── 5. Spans with withSpan (async) ────────────────────────────
  // Automatically ends the span, records exceptions, and sets error status.
  // Logs inside the callback carry trace_id and span_id.
  await withSpan("order.process", async () => {
    logger.info("Processing order");
    await simulateWork(50);
    logger.info("Order complete");
  });

  // ── 6. Spans with options ─────────────────────────────────────
  // Pass SpanKind, initial attributes, or a custom tracer name.
  const result = await withSpan("db.query", {
    kind: SpanKind.CLIENT,
    attributes: { "db.system": "postgres", "db.operation.name": "SELECT" },
  }, async (span) => {
    span.setAttribute("db.query.text", "SELECT * FROM orders WHERE id = $1");
    await simulateWork(30);
    return { rows: 42 };
  });
  logger.info("Query returned", { rows: result.rows });

  // ── 7. Sync spans ────────────────────────────────────────────
  // withSpanSync for non-async work.
  const isValid = withSpanSync("validate.input", () => {
    return "test-input".length > 0;
  });
  logger.info("Validation result", { isValid });

  // ── 8. Error handling in spans ────────────────────────────────
  // Exceptions are recorded on the span and status is set to ERROR.
  // The error is re-thrown so your code can handle it.
  try {
    await withSpan("order.charge", async () => {
      await simulateWork(10);
      throw new Error("Payment declined");
    });
  } catch {
    logger.error("Charge failed, retrying later");
  }

  // ── 9. Nested spans ──────────────────────────────────────────
  // Spans nest automatically via context propagation.
  await withSpan("http.request", { kind: SpanKind.SERVER }, async () => {
    reqLogger.info("Received POST /orders");

    await withSpan("auth.validate", async () => {
      await simulateWork(10);
      reqLogger.info("Token valid");
    });

    await withSpan("db.insert", { kind: SpanKind.CLIENT }, async () => {
      await simulateWork(20);
      reqLogger.info("Order saved");
    });

    reqLogger.info("Response sent", { status: 201 });
  });

  // ── 10. Metrics ─────────────────────────────────────────────────
  // createMetrics(name) returns a Metrics instance bound to a meter.
  const m = createMetrics("example-service");

  // Counter — things that only go up (requests, errors, orders).
  const orderCount = m.counter("orders.total");
  orderCount.add(1, { type: "new" });
  orderCount.add(1, { type: "new" });
  orderCount.add(1, { type: "refund" });

  // UpDownCounter — things that go up and down (active connections, queue size).
  const activeJobs = m.upDownCounter("jobs.active");
  activeJobs.add(1);
  activeJobs.add(1);
  activeJobs.add(-1);

  // Histogram — distributions (latency, request size).
  const requestDuration = m.histogram("http.request.duration", { unit: "ms" });
  requestDuration.record(45.2, { method: "GET", route: "/orders" });
  requestDuration.record(120.8, { method: "POST", route: "/orders" });

  // ── 11. Timed histograms ──────────────────────────────────────
  // histogram.time() measures duration automatically — no manual Date.now().
  const dbDuration = m.histogram("db.query.duration", { unit: "ms" });

  await dbDuration.time({ system: "postgres", operation: "SELECT" }, async () => {
    await simulateWork(35);
  });

  // Without attributes:
  const queryResult = await dbDuration.time(async () => {
    await simulateWork(20);
    return { rows: 10 };
  });
  logger.info("Timed query returned", { rows: queryResult.rows });

  // Sync timing:
  const parsed = dbDuration.timeSync({ operation: "parse" }, () => {
    return JSON.parse('{"ok": true}') as { ok: boolean };
  });
  logger.info("Parsed", { ok: parsed.ok });

  // ── 12. Gauge ─────────────────────────────────────────────────
  // Gauge — observes a value via callback at export time.
  let queueSize = 5;
  m.gauge("queue.size", () => queueSize);
  queueSize = 3; // next export will report 3

  // ── Shutdown ──────────────────────────────────────────────────
  await shutdown();
}

function simulateWork(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main();