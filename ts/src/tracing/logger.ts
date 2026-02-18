import pino, { type Logger, type DestinationStream } from "pino";
import { Writable } from "node:stream";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import {
  LoggerProvider,
  BatchLogRecordProcessor,
} from "@opentelemetry/sdk-logs";
import { Resource } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { SeverityNumber } from "@opentelemetry/api-logs";
import type { LogLevel, LogFormat, FileOutputConfig, OtelLogConfig } from "./types.js";

/**
 * Options for creating a Pino logger.
 */
export interface CreateLoggerOptions {
  level: LogLevel;
  format: LogFormat;
  stdout: boolean;
  file?: FileOutputConfig | undefined;
  /** When set, logs are also exported to the given OTLP endpoint. */
  otelLogs?: OtelLogConfig | undefined;
}

let _otelLoggerProvider: LoggerProvider | undefined;

/**
 * Flushes and shuts down the OTel log provider created by createLogger.
 * Call before process exit for graceful cleanup.
 */
export async function shutdownOtelLogs(): Promise<void> {
  if (_otelLoggerProvider) {
    await _otelLoggerProvider.forceFlush();
    await _otelLoggerProvider.shutdown();
    _otelLoggerProvider = undefined;
  }
}

const PINO_TO_SEVERITY: Record<number, SeverityNumber> = {
  10: SeverityNumber.TRACE,
  20: SeverityNumber.DEBUG,
  30: SeverityNumber.INFO,
  40: SeverityNumber.WARN,
  50: SeverityNumber.ERROR,
  60: SeverityNumber.FATAL,
};

const PINO_LEVEL_LABELS: Record<number, string> = {
  10: "TRACE",
  20: "DEBUG",
  30: "INFO",
  40: "WARN",
  50: "ERROR",
  60: "FATAL",
};

/**
 * Creates a Writable stream that forwards parsed Pino JSON logs
 * to an OTel LoggerProvider via OTLP HTTP.
 */
function createOtelLogStream(config: OtelLogConfig): Writable {
  const resource = new Resource({
    [ATTR_SERVICE_NAME]: config.serviceName,
  });
  const loggerProvider = new LoggerProvider({ resource });
  // When no endpoint is provided, OTLPLogExporter reads standard env vars
  // (OTEL_EXPORTER_OTLP_LOGS_ENDPOINT, OTEL_EXPORTER_OTLP_ENDPOINT)
  // and falls back to http://localhost:4318/v1/logs
  const exporter = config.endpoint
    ? new OTLPLogExporter({ url: config.endpoint })
    : new OTLPLogExporter();
  loggerProvider.addLogRecordProcessor(
    new BatchLogRecordProcessor(exporter),
  );
  _otelLoggerProvider = loggerProvider;

  const otelLogger = loggerProvider.getLogger(config.serviceName);

  return new Writable({
    write(chunk, _encoding, callback) {
      try {
        const record = JSON.parse(chunk.toString());
        const { level, time, msg, ...attributes } = record;
        otelLogger.emit({
          body: msg,
          severityNumber:
            PINO_TO_SEVERITY[level] ?? SeverityNumber.UNSPECIFIED,
          severityText: PINO_LEVEL_LABELS[level] ?? "UNSPECIFIED",
          attributes,
        });
      } catch {
        // Don't let OTel serialization errors break logging
      }
      callback();
    },
  });
}

/**
 * Creates a Pino logger with the specified configuration.
 *
 * When `otelLogs` is provided, uses `pino.multistream()` (main-thread)
 * instead of `pino.transport()` (worker-thread) to avoid Bun worker
 * thread module-resolution issues with OTel transports.
 */
export function createLogger(options: CreateLoggerOptions): Logger {
  const { level, format, stdout, file, otelLogs } = options;

  // Without OTel log export, use transport-based approach (worker thread, supports pretty)
  if (!otelLogs) {
    return createTransportLogger(level, format, stdout, file);
  }

  // With OTel log export, use multistream (main thread)
  const streams: pino.StreamEntry[] = [];

  if (stdout) {
    // Multistream runs in main thread — stdout gets raw JSON.
    // Pretty-print is only available in transport mode (no otelLogs).
    streams.push({ level, stream: process.stdout });
  }

  if (file) {
    streams.push({
      level,
      stream: pino.destination(file.path),
    });
  }

  streams.push({ level, stream: createOtelLogStream(otelLogs) });

  if (streams.length === 0) {
    streams.push({ level, stream: process.stdout });
  }

  return pino(
    {
      level,
      base: null,
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    pino.multistream(streams),
  );
}

/**
 * Transport-based logger (existing behavior).
 * Runs serialization in a worker thread; supports pino-pretty.
 */
function createTransportLogger(
  level: LogLevel,
  format: LogFormat,
  stdout: boolean,
  file?: FileOutputConfig,
): Logger {
  const targets: pino.TransportTargetOptions[] = [];

  if (stdout) {
    if (format === "pretty") {
      targets.push({
        target: "pino-pretty",
        level,
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      });
    } else {
      targets.push({
        target: "pino/file",
        level,
        options: { destination: 1 }, // stdout
      });
    }
  }

  if (file) {
    if (file.json !== false) {
      targets.push({
        target: "pino/file",
        level,
        options: { destination: file.path },
      });
    } else {
      targets.push({
        target: "pino-pretty",
        level,
        options: {
          colorize: false,
          destination: file.path,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      });
    }
  }

  if (targets.length === 0) {
    targets.push({
      target: "pino/file",
      level,
      options: { destination: 1 },
    });
  }

  const transport = pino.transport({ targets });

  return pino(
    {
      level,
      base: null,
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    transport,
  );
}

/**
 * Creates a simple synchronous logger (useful for testing or simple cases).
 * Does not use transports, writes directly to destination.
 */
export function createSimpleLogger(
  level: LogLevel = "info",
  destination?: DestinationStream,
): Logger {
  return pino(
    {
      level,
      base: null,
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    destination,
  );
}

/**
 * Creates a child logger with additional context.
 */
export function createChildLogger(
  parent: Logger,
  bindings: Record<string, unknown>,
): Logger {
  return parent.child(bindings);
}
