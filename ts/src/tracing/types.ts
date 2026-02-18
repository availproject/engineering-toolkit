import type { Logger } from "pino";

/**
 * Log levels supported by the tracing system.
 * Maps to both Pino and OpenTelemetry severity levels.
 */
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

/**
 * Log format options.
 * - json: Machine-readable JSON (production)
 * - pretty: Human-readable colored output (development)
 */
export type LogFormat = "json" | "pretty";

/**
 * OpenTelemetry configuration parameters.
 */
export interface OtelParams {
  /** Service name for telemetry identification */
  serviceName: string;
  /** Service version for telemetry */
  serviceVersion: string;
  /** OTLP endpoint for traces (e.g., http://localhost:4318/v1/traces) */
  endpointTraces?: string | undefined;
  /** OTLP endpoint for metrics (e.g., http://localhost:4318/v1/metrics) */
  endpointMetrics?: string | undefined;
  /** OTLP endpoint for logs (e.g., http://localhost:4318/v1/logs) */
  endpointLogs?: string | undefined;
}

/**
 * Configuration for exporting logs to an OTLP endpoint.
 */
export interface OtelLogConfig {
  /** OTLP endpoint for logs. When omitted, OTLPLogExporter uses its
   *  defaults: OTEL_EXPORTER_OTLP_LOGS_ENDPOINT env var, then
   *  OTEL_EXPORTER_OTLP_ENDPOINT + /v1/logs, then http://localhost:4318/v1/logs */
  endpoint?: string | undefined;
  /** Service name for log resource attribution */
  serviceName: string;
}

/**
 * File output configuration.
 */
export interface FileOutputConfig {
  /** Path to the log file */
  path: string;
  /** Whether to use JSON format for file output (defaults to true) */
  json?: boolean | undefined;
}

/**
 * Configuration for the tracing system.
 */
export interface TracingConfig {
  /** Log level (defaults to 'info' or LOG_LEVEL env var) */
  level: LogLevel;
  /** Log format for stdout (defaults to 'json' or LOG_FORMAT env var) */
  format: LogFormat;
  /** Whether to output to stdout (defaults to true) */
  stdout: boolean;
  /** File output configuration */
  file?: FileOutputConfig | undefined;
  /** OpenTelemetry configuration */
  otel?: OtelParams | undefined;
}

/**
 * Guards that manage the lifecycle of tracing resources.
 * Must be kept alive for the duration of the application.
 * Call shutdown() before process exit to ensure all telemetry is flushed.
 */
export interface TracingGuards {
  /** The configured Pino logger instance */
  logger: Logger;
  /** Gracefully shutdown all tracing resources */
  shutdown: () => Promise<void>;
}

/**
 * Result of TracingBuilder.init()
 */
export type TracingInitResult = TracingGuards;
