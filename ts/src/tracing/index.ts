import { metrics, trace } from "@opentelemetry/api";
import { createLogger } from "./logger.js";
import {
  initializeOtel,
  shutdownOtel,
  DEFAULT_ENDPOINTS,
  SHUTDOWN_TIMEOUT_MS,
  type OtelInstance,
} from "./otel.js";
import type {
  LogLevel,
  LogFormat,
  OtelParams,
  FileOutputConfig,
  TracingConfig,
  TracingGuards,
} from "./types.js";

export type {
  LogLevel,
  LogFormat,
  OtelParams,
  FileOutputConfig,
  TracingConfig,
  TracingGuards,
};

export { DEFAULT_ENDPOINTS, SHUTDOWN_TIMEOUT_MS };

export { createLogger, createSimpleLogger, createChildLogger } from "./logger.js";

/**
 * Builder for configuring and initializing the tracing system.
 * Provides a fluent API matching the Rust internal-utils pattern.
 *
 * @example
 * ```typescript
 * const { logger, shutdown } = await TracingBuilder.create()
 *   .withLogLevel('info')
 *   .withFormat('json')
 *   .withOtel({
 *     serviceName: 'my-service',
 *     serviceVersion: '1.0.0',
 *     endpointTraces: 'http://localhost:4318/v1/traces',
 *   })
 *   .init();
 *
 * logger.info({ userId: 123 }, 'User logged in');
 *
 * // On shutdown
 * await shutdown();
 * ```
 */
export class TracingBuilder {
  private config: TracingConfig;

  private constructor() {
    // Initialize with defaults from environment or sensible defaults
    this.config = {
      level: this.getEnvLogLevel(),
      format: this.getEnvLogFormat(),
      stdout: true,
      file: undefined,
      otel: undefined,
    };
  }

  /**
   * Creates a new TracingBuilder instance.
   */
  static create(): TracingBuilder {
    return new TracingBuilder();
  }

  /**
   * Alias for create() to match Rust API.
   */
  static new(): TracingBuilder {
    return TracingBuilder.create();
  }

  withLogLevel(level: LogLevel): this {
    this.config.level = level;
    return this;
  }

  /**
   * Sets the log format for stdout.
   * @param format - 'json' for production, 'pretty' for development
   */
  withFormat(format: LogFormat): this {
    this.config.format = format;
    return this;
  }

  /**
   * Enables or disables JSON format (shorthand for withFormat).
   * @param enabled - true for JSON, false for pretty
   */
  withJson(enabled: boolean): this {
    this.config.format = enabled ? "json" : "pretty";
    return this;
  }

  /**
   * Enables or disables stdout output.
   * @param enabled - Whether to output to stdout
   */
  withStdout(enabled: boolean): this {
    this.config.stdout = enabled;
    return this;
  }

  /**
   * Configures file output.
   * @param path - Path to the log file
   * @param json - Whether to use JSON format (defaults to true)
   */
  withFile(path: string, json: boolean = true): this {
    this.config.file = { path, json };
    return this;
  }

  /**
   * Configures file output with default path (./log.txt).
   */
  withDefaultFile(): this {
    return this.withFile("./log.txt");
  }

  /**
   * Configures OpenTelemetry integration.
   * @param params - OpenTelemetry configuration
   */
  withOtel(params: OtelParams): this {
    this.config.otel = params;
    return this;
  }

  /**
   * Sets the OpenTelemetry metric export interval.
   * @param intervalMs - Export interval in milliseconds
   */
  withOtelMetricExportInterval(intervalMs: number): this {
    process.env["OTEL_METRIC_EXPORT_INTERVAL"] = String(intervalMs);
    return this;
  }

  /**
   * Initializes the tracing system with the configured options.
   * Returns guards that must be kept alive for the duration of the application.
   *
   * @returns TracingGuards with logger and shutdown function
   */
  async init(): Promise<TracingGuards> {
    let otelInstance: OtelInstance | undefined;

    // Initialize OpenTelemetry first if configured
    // This ensures instrumentations are in place before creating the logger
    if (this.config.otel) {
      otelInstance = initializeOtel(this.config.otel);
    }

    // Create the Pino logger
    const logger = createLogger({
      level: this.config.level,
      format: this.config.format,
      stdout: this.config.stdout,
      file: this.config.file,
    });

    // Create shutdown function
    const shutdown = async (): Promise<void> => {
      // Flush logger
      logger.flush();

      // Shutdown OpenTelemetry
      if (otelInstance) {
        await shutdownOtel(otelInstance);
      }
    };

    // Register shutdown handlers for graceful exit
    const gracefulShutdown = async (signal: string): Promise<void> => {
      logger.info({ signal }, "Received shutdown signal, flushing telemetry...");
      await shutdown();
      process.exit(0);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    return { logger, shutdown };
  }

  /**
   * Simple initialization without builder pattern.
   * Uses environment variables and sensible defaults.
   */
  static async simpleInit(): Promise<TracingGuards> {
    return TracingBuilder.create().init();
  }

  // Private helper methods

  private getEnvLogLevel(): LogLevel {
    const env = process.env["LOG_LEVEL"];
    const validLevels: LogLevel[] = [
      "trace",
      "debug",
      "info",
      "warn",
      "error",
      "fatal",
    ];
    if (env && validLevels.includes(env as LogLevel)) {
      return env as LogLevel;
    }
    return "info";
  }

  private getEnvLogFormat(): LogFormat {
    const env = process.env["LOG_FORMAT"];
    if (env === "pretty" || env === "json") {
      return env;
    }
    // Default to pretty in development, json otherwise
    return process.env["NODE_ENV"] === "development" ? "pretty" : "json";
  }
}

/**
 * Gets a reference to the OpenTelemetry meter for creating custom metrics.
 *
 * @param name - Meter name (typically service name)
 * @returns OpenTelemetry Meter instance
 */
export function getMeter(name: string) {
  return metrics.getMeter(name);
}

/**
 * Gets a reference to the OpenTelemetry tracer for creating custom spans.
 *
 * @param name - Tracer name (typically service name)
 * @returns OpenTelemetry Tracer instance
 */
export function getTracer(name: string) {
  return trace.getTracer(name);
}
