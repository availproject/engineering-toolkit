import { trace, SpanKind, SpanStatusCode, type Span, type AttributeValue } from "@opentelemetry/api";

interface TracedOptions {
  name?: string;
  kind?: SpanKind;
  attributes?: Record<string, AttributeValue>;
  recordArgs?: boolean;
  recordResult?: boolean;
}

function getTracer() {
  return trace.getTracer("traced-decorator");
}

function recordException(span: Span, error: unknown): void {
  if (error instanceof Error) {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
  } else {
    span.recordException(new Error(String(error)));
    span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
  }
}

type AsyncMethod = (...args: never[]) => Promise<unknown>;

export function traced(nameOrOptions?: string | TracedOptions) {
  const options: TracedOptions = typeof nameOrOptions === "string" 
    ? { name: nameOrOptions } 
    : nameOrOptions ?? {};

  return function <T extends AsyncMethod>(
    originalMethod: T,
    context: ClassMethodDecoratorContext
  ): T {
    const spanName = options.name ?? String(context.name);

    async function replacement(this: unknown, ...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> {
      const tracer = getTracer();
      const attributes: Record<string, AttributeValue> = { ...options.attributes };

      if (options.recordArgs) {
        attributes["function.args"] = JSON.stringify(args);
      }

      return tracer.startActiveSpan(
        spanName,
        { kind: options.kind ?? SpanKind.INTERNAL, attributes },
        async (span) => {
          try {
            const result = await (originalMethod as Function).apply(this, args);
            
            if (options.recordResult && result !== undefined) {
              span.setAttribute("function.result", JSON.stringify(result));
            }
            
            span.setStatus({ code: SpanStatusCode.OK });
            return result;
          } catch (error) {
            recordException(span, error);
            throw error;
          } finally {
            span.end();
          }
        }
      );
    }

    return replacement as unknown as T;
  };
}

type SyncMethod = (...args: never[]) => unknown;

export function tracedSync(nameOrOptions?: string | TracedOptions) {
  const options: TracedOptions = typeof nameOrOptions === "string" 
    ? { name: nameOrOptions } 
    : nameOrOptions ?? {};

  return function <T extends SyncMethod>(
    originalMethod: T,
    context: ClassMethodDecoratorContext
  ): T {
    const spanName = options.name ?? String(context.name);

    function replacement(this: unknown, ...args: Parameters<T>): ReturnType<T> {
      const tracer = getTracer();
      const attributes: Record<string, AttributeValue> = { ...options.attributes };

      if (options.recordArgs) {
        attributes["function.args"] = JSON.stringify(args);
      }

      const span = tracer.startSpan(spanName, {
        kind: options.kind ?? SpanKind.INTERNAL,
        attributes,
      });

      try {
        const result = (originalMethod as Function).apply(this, args);

        if (options.recordResult && result !== undefined) {
          span.setAttribute("function.result", JSON.stringify(result));
        }

        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        recordException(span, error);
        throw error;
      } finally {
        span.end();
      }
    }

    return replacement as unknown as T;
  };
}

export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>
): Promise<T>;
export async function withSpan<T>(
  name: string,
  attributes: Record<string, AttributeValue>,
  fn: (span: Span) => Promise<T>
): Promise<T>;
export async function withSpan<T>(
  name: string,
  attributesOrFn: Record<string, AttributeValue> | ((span: Span) => Promise<T>),
  maybeFn?: (span: Span) => Promise<T>
): Promise<T> {
  const tracer = getTracer();
  
  const [attributes, fn] = typeof attributesOrFn === "function"
    ? [{}, attributesOrFn]
    : [attributesOrFn, maybeFn!];

  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      recordException(span, error);
      throw error;
    } finally {
      span.end();
    }
  });
}

export function withSpanSync<T>(
  name: string,
  fn: (span: Span) => T
): T;
export function withSpanSync<T>(
  name: string,
  attributes: Record<string, AttributeValue>,
  fn: (span: Span) => T
): T;
export function withSpanSync<T>(
  name: string,
  attributesOrFn: Record<string, AttributeValue> | ((span: Span) => T),
  maybeFn?: (span: Span) => T
): T {
  const tracer = getTracer();
  
  const [attributes, fn] = typeof attributesOrFn === "function"
    ? [{}, attributesOrFn]
    : [attributesOrFn, maybeFn!];

  const span = tracer.startSpan(name, { attributes });

  try {
    const result = fn(span);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    recordException(span, error);
    throw error;
  } finally {
    span.end();
  }
}
