// Run: npx tsx src/example-service.ts
//
// Realistic service example — traces, logs, and metrics working together
// with @opentelemetry/semantic-conventions.
// For the API walkthrough, see src/example.ts.

import { SpanKind } from "@opentelemetry/api";
import {
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_HTTP_ROUTE,
  ATTR_URL_SCHEME,
  ATTR_URL_PATH,
  ATTR_SERVER_ADDRESS,
  ATTR_SERVER_PORT,
  ATTR_CLIENT_ADDRESS,
  ATTR_USER_AGENT_ORIGINAL,
  ATTR_ERROR_TYPE,
  ATTR_DB_SYSTEM_NAME,
  ATTR_DB_OPERATION_NAME,
  ATTR_DB_COLLECTION_NAME,
  ATTR_DB_QUERY_TEXT,
  ATTR_DB_NAMESPACE,
} from "@opentelemetry/semantic-conventions";
import { TracingBuilder, getLogger, withSpan, withSpanSync, createMetrics } from "./index.js";

// ── Setup (once at startup) ─────────────────────────────────────

const { logger, shutdown } = await new TracingBuilder()
  .withJson(false)
  .withOtel({
    serviceName: "order-service",
    endpointTraces: "http://localhost:4318/v1/traces",
    endpointLogs: "http://localhost:4318/v1/logs",
    endpointMetrics: "http://localhost:4318/v1/metrics",
  })
  .build();

const m = createMetrics("order-service");
const httpDuration = m.histogram("http.server.duration", { unit: "ms" });
const httpRequests = m.counter("http.server.requests");
const dbDuration = m.histogram("db.client.duration", { unit: "ms" });
const activeRequests = m.upDownCounter("http.server.active_requests");
let orderBacklog = 0;
m.gauge("orders.backlog", () => orderBacklog);

const billingLogger = getLogger("billing");

logger.info("Order service started", { version: "1.0.0" });

// ── POST /orders — happy path ───────────────────────────────────
// One trace with nested spans, logs at each step, metrics recorded.
// Every log inside carries trace_id + span_id automatically.

activeRequests.add(1);
orderBacklog++;

await httpDuration.time(
  { [ATTR_HTTP_REQUEST_METHOD]: "POST", [ATTR_HTTP_ROUTE]: "/orders" },
  async () => {
    await withSpan("POST /orders", {
      kind: SpanKind.SERVER,
      attributes: {
        [ATTR_HTTP_REQUEST_METHOD]: "POST",
        [ATTR_HTTP_ROUTE]: "/orders",
        [ATTR_URL_SCHEME]: "https",
        [ATTR_URL_PATH]: "/api/v1/orders",
        [ATTR_SERVER_ADDRESS]: "api.example.com",
        [ATTR_SERVER_PORT]: 443,
        [ATTR_CLIENT_ADDRESS]: "192.168.1.42",
        [ATTR_USER_AGENT_ORIGINAL]: "Mozilla/5.0",
      },
    }, async (rootSpan) => {
      const log = logger.child({ requestId: "req-777" });
      log.info("Request received");

      httpRequests.add(1, {
        [ATTR_HTTP_REQUEST_METHOD]: "POST",
        [ATTR_HTTP_ROUTE]: "/orders",
      });

      // Sync validation
      const isValid = withSpanSync("validate.input", () => {
        log.debug("Validating payload");
        return true;
      });

      if (!isValid) {
        rootSpan.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, 400);
        log.warn("Invalid payload");
        return;
      }

      // DB insert — nested span + timed histogram + semantic conventions
      const order = await withSpan("INSERT orders", {
        kind: SpanKind.CLIENT,
        attributes: {
          [ATTR_DB_SYSTEM_NAME]: "postgresql",
          [ATTR_DB_OPERATION_NAME]: "INSERT",
          [ATTR_DB_COLLECTION_NAME]: "orders",
          [ATTR_DB_NAMESPACE]: "shop",
          [ATTR_DB_QUERY_TEXT]: "INSERT INTO orders (user_id, total) VALUES ($1, $2)",
        },
      }, async () => {
        log.info("Inserting order");

        const row = await dbDuration.time(
          { [ATTR_DB_SYSTEM_NAME]: "postgresql", [ATTR_DB_OPERATION_NAME]: "INSERT" },
          async () => {
            await simulateWork(25);
            return { orderId: "ord-999", total: 149.99 };
          },
        );

        log.info("Order persisted", { orderId: row.orderId });
        return row;
      });

      // Billing — nested span + getLogger from another module
      await withSpan("billing.charge", async () => {
        billingLogger.info("Charging card", { amount: order.total, orderId: order.orderId });
        await simulateWork(40);
        billingLogger.info("Payment captured", { orderId: order.orderId });
      });

      rootSpan.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, 201);
      log.info("Response sent", { status: 201, orderId: order.orderId });
    });
  },
);

activeRequests.add(-1);
orderBacklog--;

// ── GET /orders/:id — error path ────────────────────────────────
// withSpan records the exception and sets error status automatically.
// ATTR_ERROR_TYPE tags the span for filtering in your backend.

try {
  await withSpan("GET /orders/bad", {
    kind: SpanKind.SERVER,
    attributes: {
      [ATTR_HTTP_REQUEST_METHOD]: "GET",
      [ATTR_HTTP_ROUTE]: "/orders/:id",
    },
  }, async (span) => {
    logger.info("Looking up order", { orderId: "ord-000" });
    await simulateWork(10);

    span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, 404);
    span.setAttribute(ATTR_ERROR_TYPE, "OrderNotFoundError");
    throw new Error("Order not found");
  });
} catch {
  logger.error("Request failed", { route: "/orders/:id" });
  httpRequests.add(1, {
    [ATTR_HTTP_REQUEST_METHOD]: "GET",
    [ATTR_HTTP_ROUTE]: "/orders/:id",
  });
}

// ─────────────────────────────────────────────────────────────────

await shutdown();

function simulateWork(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
