export {
  TracingBuilder,
  createLogger,
  createSimpleLogger,
  createChildLogger,
  getMeter,
  getTracer,
  DEFAULT_ENDPOINTS,
  SHUTDOWN_TIMEOUT_MS,
  traced,
  tracedSync,
  withSpan,
  withSpanSync,
  createMetricsHelper,
  MetricsHelper,
} from "./tracing/index.js";

export type {
  LogLevel,
  LogFormat,
  OtelParams,
  FileOutputConfig,
  TracingConfig,
  TracingGuards,
  HttpRequestOptions,
  DbQueryOptions,
} from "./tracing/index.js";

export { default as pino } from "pino";
export type { Logger } from "pino";
