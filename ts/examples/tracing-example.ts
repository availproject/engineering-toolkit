// Run: cd signoz/deploy/docker/clickhouse-setup && docker compose up -d
// Run: npx tsx examples/tracing-example.ts

import {
  TracingBuilder,
  createMetricsHelper,
  withSpan,
  traced,
  tracedSync,
} from "../src/index.js";
import { SpanKind, context, trace } from "@opentelemetry/api";

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

class OrderService {
  private metricsHelper = createMetricsHelper("order-service");

  @traced({ name: "http.request", kind: SpanKind.SERVER })
  async createOrder(request: CreateOrderRequest): Promise<CreateOrderResponse> {
    const startTime = Date.now();

    const orderId = `ord_${crypto.randomUUID()}`;
    console.log(`[order.create] Creating new order ${orderId}`);

    if (request.items.length === 0) {
      console.warn("[order.create.discarded] Order must have at least one item");
      throw new ApiError("Order must have at least one item", "invalid_request");
    }

    if (request.total <= 0) {
      console.warn("[order.create.discarded] Order total must be positive");
      throw new ApiError("Order total must be positive", "invalid_request");
    }

    try {
      await this.processOrder(orderId, request);

      console.log(`[order.create.success] Order ${orderId} created successfully`);

      this.metricsHelper.recordHttpRequest({
        method: "POST",
        route: "/orders",
        statusCode: 201,
        durationMs: Date.now() - startTime,
      });

      return { orderId };
    } catch (error) {
      this.metricsHelper.recordHttpRequest({
        method: "POST",
        route: "/orders",
        statusCode: 500,
        durationMs: Date.now() - startTime,
      });
      throw error;
    }
  }

  @traced("order.process")
  private async processOrder(
    orderId: string,
    request: CreateOrderRequest
  ): Promise<void> {
    console.log("[order.process.start] Processing order");

    await new Promise((resolve) => setTimeout(resolve, 50));

    if (request.total > 10000) {
      throw new Error("Amount exceeds limit");
    }

    console.log("[order.process.complete] Order processing complete");
  }
}

async function standaloneExample(): Promise<void> {
  const result = await withSpan("standalone.operation", async (span) => {
    span.setAttribute("custom.attribute", "value");
    await new Promise((resolve) => setTimeout(resolve, 10));
    return "completed";
  });
  console.log(`Standalone operation result: ${result}`);
}

class UtilityService {
  @tracedSync("sync.validate")
  validateInput(input: string): boolean {
    return input.length > 0;
  }
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

  const orderService = new OrderService();
  const utilityService = new UtilityService();

  const isValid = utilityService.validateInput("test");
  console.log(`Input validation: ${isValid}`);

  await standaloneExample();

  const requests: CreateOrderRequest[] = [
    { userId: "user_123", items: ["item_1", "item_2"], total: 99.99 },
    { userId: "user_456", items: [], total: 50.0 },
    { userId: "user_789", items: ["item_3"], total: 15000 },
  ];

  for (const request of requests) {
    try {
      await orderService.createOrder(request);
    } catch {
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  logger.info({ "otel.name": "service.stop" }, "Order service stopping");

  await new Promise((resolve) => setTimeout(resolve, 6000));
  await shutdown();
}

main().catch(console.error);
