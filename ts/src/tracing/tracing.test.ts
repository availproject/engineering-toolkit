/**
 * Tracing module tests.
 *
 * Test categories:
 * - Unit tests: Run without external dependencies
 * - Integration tests (requires SigNoz): Tests in "OTEL Integration (requires SigNoz)" describe block
 *
 * To run integration tests, start SigNoz first:
 *   git clone https://github.com/SigNoz/signoz.git
 *   cd signoz/deploy/docker/clickhouse-setup
 *   docker compose up -d
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import {
  TracingBuilder,
  getMeter,
  getTracer,
  DEFAULT_ENDPOINTS,
  SHUTDOWN_TIMEOUT_MS,
  createSimpleLogger,
  createChildLogger,
} from "./index.js";

describe("DEFAULT_ENDPOINTS", () => {
  it("should have correct default trace endpoint", () => {
    assert.strictEqual(
      DEFAULT_ENDPOINTS.traces,
      "http://localhost:4318/v1/traces"
    );
  });

  it("should have correct default metrics endpoint", () => {
    assert.strictEqual(
      DEFAULT_ENDPOINTS.metrics,
      "http://localhost:4318/v1/metrics"
    );
  });

  it("should have correct default logs endpoint", () => {
    assert.strictEqual(DEFAULT_ENDPOINTS.logs, "http://localhost:4318/v1/logs");
  });
});

describe("SHUTDOWN_TIMEOUT_MS", () => {
  it("should be 100ms", () => {
    assert.strictEqual(SHUTDOWN_TIMEOUT_MS, 100);
  });
});

describe("TracingBuilder", () => {
  it("should create builder with static create()", () => {
    const builder = TracingBuilder.create();
    assert.ok(builder instanceof TracingBuilder);
  });

  it("should create builder with static new()", () => {
    const builder = TracingBuilder.new();
    assert.ok(builder instanceof TracingBuilder);
  });

  it("should support fluent API chaining", () => {
    const builder = TracingBuilder.create()
      .withLogLevel("debug")
      .withFormat("json")
      .withStdout(true)
      .withJson(false);

    assert.ok(builder instanceof TracingBuilder);
  });

  it("should support withDefaultFile()", () => {
    const builder = TracingBuilder.create().withDefaultFile();
    assert.ok(builder instanceof TracingBuilder);
  });

  it("should support withFile() with custom path", () => {
    const builder = TracingBuilder.create().withFile("./custom.log", true);
    assert.ok(builder instanceof TracingBuilder);
  });

  it("should support withOtelMetricExportInterval()", () => {
    const originalEnv = process.env["OTEL_METRIC_EXPORT_INTERVAL"];

    TracingBuilder.create().withOtelMetricExportInterval(5000);

    assert.strictEqual(process.env["OTEL_METRIC_EXPORT_INTERVAL"], "5000");

    if (originalEnv !== undefined) {
      process.env["OTEL_METRIC_EXPORT_INTERVAL"] = originalEnv;
    } else {
      delete process.env["OTEL_METRIC_EXPORT_INTERVAL"];
    }
  });

  it("should initialize without OTEL when not configured", async () => {
    const { logger, shutdown } = await TracingBuilder.create()
      .withLogLevel("info")
      .withStdout(false)
      .init();

    assert.ok(logger);
    assert.ok(typeof shutdown === "function");
    await shutdown();
  });

  it("should respect LOG_LEVEL environment variable", async () => {
    const originalLogLevel = process.env["LOG_LEVEL"];
    process.env["LOG_LEVEL"] = "debug";

    const { logger, shutdown } = await TracingBuilder.create()
      .withStdout(false)
      .init();

    assert.strictEqual(logger.level, "debug");
    await shutdown();

    if (originalLogLevel !== undefined) {
      process.env["LOG_LEVEL"] = originalLogLevel;
    } else {
      delete process.env["LOG_LEVEL"];
    }
  });

  it("should default to json format in production", async () => {
    const originalNodeEnv = process.env["NODE_ENV"];
    const originalLogFormat = process.env["LOG_FORMAT"];

    process.env["NODE_ENV"] = "production";
    delete process.env["LOG_FORMAT"];

    const { shutdown } = await TracingBuilder.create().withStdout(false).init();

    await shutdown();

    if (originalNodeEnv !== undefined) {
      process.env["NODE_ENV"] = originalNodeEnv;
    } else {
      delete process.env["NODE_ENV"];
    }
    if (originalLogFormat !== undefined) {
      process.env["LOG_FORMAT"] = originalLogFormat;
    }
  });

  it("should default to pretty format in development", async () => {
    const originalNodeEnv = process.env["NODE_ENV"];
    const originalLogFormat = process.env["LOG_FORMAT"];

    process.env["NODE_ENV"] = "development";
    delete process.env["LOG_FORMAT"];

    const { shutdown } = await TracingBuilder.create().withStdout(false).init();

    await shutdown();

    if (originalNodeEnv !== undefined) {
      process.env["NODE_ENV"] = originalNodeEnv;
    } else {
      delete process.env["NODE_ENV"];
    }
    if (originalLogFormat !== undefined) {
      process.env["LOG_FORMAT"] = originalLogFormat;
    }
  });

  it("should respect LOG_FORMAT environment variable", async () => {
    const originalLogFormat = process.env["LOG_FORMAT"];
    process.env["LOG_FORMAT"] = "pretty";

    const { shutdown } = await TracingBuilder.create().withStdout(false).init();

    await shutdown();

    if (originalLogFormat !== undefined) {
      process.env["LOG_FORMAT"] = originalLogFormat;
    } else {
      delete process.env["LOG_FORMAT"];
    }
  });

  it("should provide simpleInit() static method", async () => {
    const { logger, shutdown } = await TracingBuilder.simpleInit();
    assert.ok(logger);
    await shutdown();
  });
});

describe("getMeter", () => {
  it("should return a meter instance", () => {
    const meter = getMeter("test-service");
    assert.ok(meter);
    assert.ok(typeof meter.createCounter === "function");
    assert.ok(typeof meter.createHistogram === "function");
    assert.ok(typeof meter.createUpDownCounter === "function");
  });

  it("should create counters", () => {
    const meter = getMeter("test-service");
    const counter = meter.createCounter("test_counter");
    assert.ok(counter);
    assert.ok(typeof counter.add === "function");
  });

  it("should create histograms", () => {
    const meter = getMeter("test-service");
    const histogram = meter.createHistogram("test_histogram");
    assert.ok(histogram);
    assert.ok(typeof histogram.record === "function");
  });
});

describe("getTracer", () => {
  it("should return a tracer instance", () => {
    const tracer = getTracer("test-service");
    assert.ok(tracer);
    assert.ok(typeof tracer.startSpan === "function");
  });

  it("should create spans", () => {
    const tracer = getTracer("test-service");
    const span = tracer.startSpan("test-span");
    assert.ok(span);
    assert.ok(typeof span.end === "function");
    assert.ok(typeof span.setAttribute === "function");
    span.end();
  });

  it("should support span attributes", () => {
    const tracer = getTracer("test-service");
    const span = tracer.startSpan("test-span");

    span.setAttribute("key", "value");
    span.setAttribute("number", 42);
    span.setAttribute("boolean", true);

    span.end();
  });
});

describe("createSimpleLogger", () => {
  it("should create a logger with default level", () => {
    const logger = createSimpleLogger();
    assert.ok(logger);
    assert.strictEqual(logger.level, "info");
  });

  it("should create a logger with specified level", () => {
    const logger = createSimpleLogger("debug");
    assert.ok(logger);
    assert.strictEqual(logger.level, "debug");
  });

  it("should have all log methods", () => {
    const logger = createSimpleLogger();
    assert.ok(typeof logger.trace === "function");
    assert.ok(typeof logger.debug === "function");
    assert.ok(typeof logger.info === "function");
    assert.ok(typeof logger.warn === "function");
    assert.ok(typeof logger.error === "function");
    assert.ok(typeof logger.fatal === "function");
  });
});

describe("createChildLogger", () => {
  it("should create a child logger with bindings", () => {
    const parent = createSimpleLogger();
    const child = createChildLogger(parent, { requestId: "abc-123" });

    assert.ok(child);
    assert.notStrictEqual(child, parent);
  });

  it("should inherit parent log level", () => {
    const parent = createSimpleLogger("debug");
    const child = createChildLogger(parent, { service: "test" });

    assert.strictEqual(child.level, "debug");
  });

  it("should support nested child loggers", () => {
    const parent = createSimpleLogger();
    const child1 = createChildLogger(parent, { level1: "a" });
    const child2 = createChildLogger(child1, { level2: "b" });

    assert.ok(child2);
  });
});

describe("TracingBuilder OTEL configuration", () => {
  it("should accept OTEL params", () => {
    const builder = TracingBuilder.create().withOtel({
      serviceName: "test-service",
      serviceVersion: "1.0.0",
    });

    assert.ok(builder instanceof TracingBuilder);
  });

  it("should accept OTEL params with custom endpoints", () => {
    const builder = TracingBuilder.create().withOtel({
      serviceName: "test-service",
      serviceVersion: "1.0.0",
      endpointTraces: "http://custom:4318/v1/traces",
      endpointMetrics: "http://custom:4318/v1/metrics",
      endpointLogs: "http://custom:4318/v1/logs",
    });

    assert.ok(builder instanceof TracingBuilder);
  });

  it("should accept OTEL params with partial endpoints", () => {
    const builder = TracingBuilder.create().withOtel({
      serviceName: "test-service",
      serviceVersion: "1.0.0",
      endpointTraces: "http://custom:4318/v1/traces",
    });

    assert.ok(builder instanceof TracingBuilder);
  });
});

describe("OTEL metric export interval", () => {
  const originalEnv = process.env["OTEL_METRIC_EXPORT_INTERVAL"];

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env["OTEL_METRIC_EXPORT_INTERVAL"] = originalEnv;
    } else {
      delete process.env["OTEL_METRIC_EXPORT_INTERVAL"];
    }
  });

  it("should read interval from environment variable", () => {
    process.env["OTEL_METRIC_EXPORT_INTERVAL"] = "30000";

    TracingBuilder.create().withOtelMetricExportInterval(30000);

    assert.strictEqual(process.env["OTEL_METRIC_EXPORT_INTERVAL"], "30000");
  });

  it("should set interval via builder method", () => {
    TracingBuilder.create().withOtelMetricExportInterval(15000);

    assert.strictEqual(process.env["OTEL_METRIC_EXPORT_INTERVAL"], "15000");
  });
});

describe("Logger functionality", () => {
  it("should support structured logging", async () => {
    const { logger, shutdown } = await TracingBuilder.create()
      .withLogLevel("info")
      .withStdout(false)
      .init();

    logger.info({ userId: 123, action: "test" }, "Test message");
    logger.warn({ latency: 500 }, "Slow operation");
    logger.error({ err: new Error("test error") }, "Error occurred");

    await shutdown();
  });

  it("should support child loggers with context", async () => {
    const { logger, shutdown } = await TracingBuilder.create()
      .withStdout(false)
      .init();

    const requestLogger = logger.child({ requestId: "req-123" });
    requestLogger.info("Processing request");

    const userLogger = requestLogger.child({ userId: 456 });
    userLogger.info("User action");

    await shutdown();
  });

  it("should flush on shutdown", async () => {
    const { logger, shutdown } = await TracingBuilder.create()
      .withStdout(false)
      .init();

    logger.info("Message before shutdown");

    await shutdown();
  });
});

describe("Type exports", () => {
  it("should export LogLevel type values", async () => {
    const levels: Array<"trace" | "debug" | "info" | "warn" | "error" | "fatal"> = [
      "trace",
      "debug",
      "info",
      "warn",
      "error",
      "fatal",
    ];

    for (const level of levels) {
      const { shutdown } = await TracingBuilder.create()
        .withLogLevel(level)
        .withStdout(false)
        .init();
      await shutdown();
    }
  });

  it("should export LogFormat type values", async () => {
    const formats: Array<"json" | "pretty"> = ["json", "pretty"];

    for (const format of formats) {
      const { shutdown } = await TracingBuilder.create()
        .withFormat(format)
        .withStdout(false)
        .init();
      await shutdown();
    }
  });
});

/**
 * OTEL Integration tests - require running SigNoz instance.
 *
 * Start SigNoz before running:
 *   git clone https://github.com/SigNoz/signoz.git
 *   cd signoz/deploy/docker/clickhouse-setup
 *   docker compose up -d
 *
 * Then run: npm test
 */
describe("OTEL Integration (requires SigNoz)", { skip: !process.env["RUN_INTEGRATION_TESTS"] }, () => {
  it("should initialize with OTEL and export traces", async () => {
    const { logger, shutdown } = await TracingBuilder.create()
      .withLogLevel("info")
      .withStdout(false)
      .withOtel({
        serviceName: "test-service",
        serviceVersion: "1.0.0",
      })
      .init();

    const tracer = getTracer("test-service");
    const span = tracer.startSpan("integration-test-span");
    span.setAttribute("test", true);
    logger.info("Integration test log");
    span.end();

    await shutdown();
  });

  it("should export metrics", async () => {
    const { shutdown } = await TracingBuilder.create()
      .withStdout(false)
      .withOtel({
        serviceName: "test-service",
        serviceVersion: "1.0.0",
      })
      .withOtelMetricExportInterval(1000)
      .init();

    const meter = getMeter("test-service");
    const counter = meter.createCounter("integration_test_counter");
    counter.add(1, { test: "true" });

    await new Promise((resolve) => setTimeout(resolve, 1500));
    await shutdown();
  });

  it("should export logs", async () => {
    const { logger, shutdown } = await TracingBuilder.create()
      .withStdout(false)
      .withOtel({
        serviceName: "test-service",
        serviceVersion: "1.0.0",
      })
      .init();

    logger.info({ integration: true }, "Integration test log message");
    logger.warn({ integration: true }, "Integration test warning");
    logger.error({ integration: true }, "Integration test error");

    await shutdown();
  });
});
