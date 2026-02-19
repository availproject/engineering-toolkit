import { logs, SeverityNumber, type AnyValueMap, type Logger as OtelLogger } from "@opentelemetry/api-logs";
import { context } from "@opentelemetry/api";

export type Fields = AnyValueMap;

export class Logger {
  private readonly otel: OtelLogger;
  private readonly attrs: Fields;

  constructor(otel: OtelLogger, attrs: Fields = {}) {
    this.otel = otel;
    this.attrs = attrs;
  }

  child(attrs: Fields): Logger {
    return new Logger(this.otel, { ...this.attrs, ...attrs });
  }

  trace(message: string, fields: Fields = {}) {
    this.emit(SeverityNumber.TRACE, "TRACE", message, fields);
  }

  debug(message: string, fields: Fields = {}) {
    this.emit(SeverityNumber.DEBUG, "DEBUG", message, fields);
  }

  info(message: string, fields: Fields = {}) {
    this.emit(SeverityNumber.INFO, "INFO", message, fields);
  }

  warn(message: string, fields: Fields = {}) {
    this.emit(SeverityNumber.WARN, "WARN", message, fields);
  }

  error(message: string, fields: Fields = {}) {
    this.emit(SeverityNumber.ERROR, "ERROR", message, fields);
  }

  fatal(message: string, fields: Fields = {}) {
    this.emit(SeverityNumber.FATAL, "FATAL", message, fields);
  }

  private emit(severityNumber: SeverityNumber, severityText: string, message: string, fields: Fields) {
    this.otel.emit({
      severityNumber,
      severityText,
      body: message,
      attributes: { ...this.attrs, ...fields },
      context: context.active(),
    });
  }
}

/**
 * Get a named logger from the global LoggerProvider.
 * Works after TracingBuilder.build() has been called.
 * Before init, returns a no-op logger (safe to call, does nothing).
 */
export function getLogger(name: string): Logger {
  return new Logger(logs.getLogger(name));
}
