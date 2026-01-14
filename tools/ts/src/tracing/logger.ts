import pino, { type Logger, type DestinationStream } from "pino";
import type { LogLevel, LogFormat, FileOutputConfig } from "./types.js";

/**
 * Options for creating a Pino logger.
 */
export interface CreateLoggerOptions {
  level: LogLevel;
  format: LogFormat;
  stdout: boolean;
  file?: FileOutputConfig | undefined;
}

/**
 * Creates a Pino logger with the specified configuration.
 *
 * @param options - Logger configuration options
 * @returns Configured Pino logger instance
 */
export function createLogger(options: CreateLoggerOptions): Logger {
  const { level, format, stdout, file } = options;

  // Build transport targets
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
      // JSON format for file (default)
      targets.push({
        target: "pino/file",
        level,
        options: { destination: file.path },
      });
    } else {
      // Pretty format for file
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

  // If no targets, at least write to stdout
  if (targets.length === 0) {
    targets.push({
      target: "pino/file",
      level,
      options: { destination: 1 },
    });
  }

  const transport = pino.transport({
    targets,
  });

  return pino(
    {
      level,
      // Base context that will be included in every log
      base: null, // Remove default pid and hostname
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    transport
  );
}

/**
 * Creates a simple synchronous logger (useful for testing or simple cases).
 * Does not use transports, writes directly to destination.
 *
 * @param level - Log level
 * @param destination - Optional destination stream (defaults to stdout)
 * @returns Configured Pino logger instance
 */
export function createSimpleLogger(
  level: LogLevel = "info",
  destination?: DestinationStream
): Logger {
  return pino(
    {
      level,
      base: null, // Remove default pid and hostname
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    destination
  );
}

/**
 * Creates a child logger with additional context.
 *
 * @param parent - Parent logger
 * @param bindings - Additional context to include in all logs from this child
 * @returns Child logger with merged context
 */
export function createChildLogger(
  parent: Logger,
  bindings: Record<string, unknown>
): Logger {
  return parent.child(bindings);
}
