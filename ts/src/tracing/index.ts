import { type Span, type SpanOptions, SpanStatusCode, metrics, trace } from "@opentelemetry/api";

export { type OtelParams, type InitResult, TracingBuilder } from "./otel.js";
export { Logger, getLogger, type Fields } from "./logger.js";
export { Metrics, TimedHistogram, createMetrics, type InstrumentOptions } from "./metrics.js";

export interface TraceOptions extends SpanOptions {
  tracer?: string;
}

export function getMeter(name: string) {
  return metrics.getMeter(name);
}

export function getTracer(name: string) {
  return trace.getTracer(name);
}

export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
): Promise<T>;
export async function withSpan<T>(
  name: string,
  options: TraceOptions,
  fn: (span: Span) => Promise<T>,
): Promise<T>;
export async function withSpan<T>(
  name: string,
  optionsOrFn: TraceOptions | ((span: Span) => Promise<T>),
  maybeFn?: (span: Span) => Promise<T>,
): Promise<T> {
  const [options, fn] = typeof optionsOrFn === "function"
    ? [{}, optionsOrFn]
    : [optionsOrFn, maybeFn!];

  const { tracer: tracerName, ...spanOptions } = options;
  const tracer = trace.getTracer(tracerName ?? "app");

  return tracer.startActiveSpan(name, spanOptions, async (span) => {
    try {
      return await fn(span);
    } catch (error) {
      if (error instanceof Error) {
        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      }
      throw error;
    } finally {
      span.end();
    }
  });
}

export function withSpanSync<T>(
  name: string,
  fn: (span: Span) => T,
): T;
export function withSpanSync<T>(
  name: string,
  options: TraceOptions,
  fn: (span: Span) => T,
): T;
export function withSpanSync<T>(
  name: string,
  optionsOrFn: TraceOptions | ((span: Span) => T),
  maybeFn?: (span: Span) => T,
): T {
  const [options, fn] = typeof optionsOrFn === "function"
    ? [{}, optionsOrFn]
    : [optionsOrFn, maybeFn!];

  const { tracer: tracerName, ...spanOptions } = options;
  const tracer = trace.getTracer(tracerName ?? "app");

  return tracer.startActiveSpan(name, spanOptions, (span) => {
    try {
      return fn(span);
    } catch (error) {
      if (error instanceof Error) {
        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      }
      throw error;
    } finally {
      span.end();
    }
  });
}
