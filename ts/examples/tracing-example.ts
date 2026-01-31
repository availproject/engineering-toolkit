// Run: cd signoz/deploy/docker/clickhouse-setup && docker compose up -d
// Run: npx tsx examples/tracing-example.ts

import { TracingBuilder, getMeter, getTracer } from "../src/index.js";
import { SpanStatusCode, SpanKind, context, trace } from "@opentelemetry/api";

interface CreateOrderRequest {
  userId: string;
  items: string[];
  total: number;
}

interface CreateOrderResponse {
  orderId: string;
}

class ApiError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
  }
}

async function createOrder(
  request: CreateOrderRequest
): Promise<CreateOrderResponse> {
  const tracer = getTracer("order-service");
  const span = tracer.startSpan("http.request", {
    kind: SpanKind.SERVER,
    attributes: {
      "http.method": "POST",
      "http.route": "/orders",
    },
  });

  const ctx = trace.setSpan(context.active(), span);

  try {
    const orderId = `ord_${crypto.randomUUID()}`;

    span.setAttribute("order.id", orderId);
    span.setAttribute("user.id", request.userId);
    console.log(`[order.create] Creating new order ${orderId}`);

    if (request.items.length === 0) {
      span.setAttribute("otel.name", "order.create.discarded");
      span.setAttribute("reason", "no_items");
      console.warn("[order.create.discarded] Order must have at least one item");
      throw new ApiError("Order must have at least one item", "invalid_request");
    }

    if (request.total <= 0) {
      span.setAttribute("otel.name", "order.create.discarded");
      span.setAttribute("reason", "invalid_total");
      span.setAttribute("order.total", request.total);
      console.warn("[order.create.discarded] Order total must be positive");
      throw new ApiError("Order total must be positive", "invalid_request");
    }

    await context.with(ctx, () => processOrder(orderId, request));

    span.setAttribute("otel.name", "order.create.success");
    console.log(`[order.create.success] Order ${orderId} created successfully`);
    span.setStatus({ code: SpanStatusCode.OK });

    return { orderId };
  } catch (error) {
    if (error instanceof ApiError) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw error;
    }

    span.setAttribute("otel.name", "order.create.failed");
    span.setAttribute("error.code", "ORDER_PROCESSING_FAILED");
    span.setAttribute("error.details", String(error));
    console.error(`[order.create.failed] Failed to process order: ${error}`);
    span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });

    throw new ApiError(String(error), "internal_error");
  } finally {
    span.end();
  }
}

async function processOrder(
  orderId: string,
  request: CreateOrderRequest
): Promise<void> {
  const tracer = getTracer("order-service");
  const span = tracer.startSpan("order.process", {
    attributes: { "order.id": orderId },
  });

  try {
    console.log("[order.process.start] Processing order");

    await new Promise((resolve) => setTimeout(resolve, 50));

    if (request.total > 10000) {
      throw new Error("Amount exceeds limit");
    }

    console.log("[order.process.complete] Order processing complete");
    span.setStatus({ code: SpanStatusCode.OK });
  } catch (error) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
    throw error;
  } finally {
    span.end();
  }
}

function recordMetrics(success: boolean, durationMs: number): void {
  const meter = getMeter("order-service");

  const counter = meter.createCounter("orders_total");
  counter.add(1, { status: success ? "success" : "error" });

  const histogram = meter.createHistogram("order_duration_ms");
  histogram.record(durationMs);
}

async function main(): Promise<void> {
  const { logger, shutdown } = await TracingBuilder.create()
    .withLogLevel("info")
    .withJson(true)
    .withStdout(false)
    .withOtel({
      serviceName: "order-service",
      serviceVersion: "1.0.0",
    })
    .withOtelMetricExportInterval(5000)
    .init();

  logger.info({ "otel.name": "service.start" }, "Order service started");

  const requests: CreateOrderRequest[] = [
    { userId: "user_123", items: ["item_1", "item_2"], total: 99.99 },
    { userId: "user_456", items: [], total: 50.0 },
    { userId: "user_789", items: ["item_3"], total: 15000 },
  ];

  for (const request of requests) {
    const start = Date.now();
    try {
      await createOrder(request);
      recordMetrics(true, Date.now() - start);
    } catch {
      recordMetrics(false, Date.now() - start);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  logger.info({ "otel.name": "service.stop" }, "Order service stopping");

  await new Promise((resolve) => setTimeout(resolve, 6000));
  await shutdown();
}

main().catch(console.error);
