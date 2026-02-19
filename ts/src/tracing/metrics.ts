import { metrics, type Attributes, type Counter, type UpDownCounter } from "@opentelemetry/api";

export interface InstrumentOptions {
  description?: string;
  unit?: string;
}

export class TimedHistogram {
  private readonly histogram;

  constructor(histogram: ReturnType<ReturnType<typeof metrics.getMeter>["createHistogram"]>) {
    this.histogram = histogram;
  }

  record(value: number, attrs?: Attributes) {
    this.histogram.record(value, attrs);
  }

  async time<T>(fn: () => Promise<T>): Promise<T>;
  async time<T>(attrs: Attributes, fn: () => Promise<T>): Promise<T>;
  async time<T>(
    attrsOrFn: Attributes | (() => Promise<T>),
    maybeFn?: () => Promise<T>,
  ): Promise<T> {
    const [attrs, fn] = typeof attrsOrFn === "function"
      ? [undefined, attrsOrFn]
      : [attrsOrFn, maybeFn!];

    const start = performance.now();
    try {
      return await fn();
    } finally {
      this.histogram.record(performance.now() - start, attrs);
    }
  }

  timeSync<T>(fn: () => T): T;
  timeSync<T>(attrs: Attributes, fn: () => T): T;
  timeSync<T>(
    attrsOrFn: Attributes | (() => T),
    maybeFn?: () => T,
  ): T {
    const [attrs, fn] = typeof attrsOrFn === "function"
      ? [undefined, attrsOrFn]
      : [attrsOrFn, maybeFn!];

    const start = performance.now();
    try {
      return fn();
    } finally {
      this.histogram.record(performance.now() - start, attrs);
    }
  }
}

export class Metrics {
  private readonly meter;

  constructor(name: string) {
    this.meter = metrics.getMeter(name);
  }

  counter(name: string, options?: InstrumentOptions): Counter {
    return this.meter.createCounter(name, options);
  }

  histogram(name: string, options?: InstrumentOptions): TimedHistogram {
    return new TimedHistogram(this.meter.createHistogram(name, options));
  }

  upDownCounter(name: string, options?: InstrumentOptions): UpDownCounter {
    return this.meter.createUpDownCounter(name, options);
  }

  gauge(name: string, callback: () => number, options?: InstrumentOptions & { attributes?: Attributes }) {
    const attrs = options?.attributes ?? {};
    const gaugeOptions: InstrumentOptions = {};
    if (options?.description) gaugeOptions.description = options.description;
    if (options?.unit) gaugeOptions.unit = options.unit;

    this.meter.createObservableGauge(name, gaugeOptions).addCallback((result) => {
      result.observe(callback(), attrs);
    });
  }
}

export function createMetrics(name: string): Metrics {
  return new Metrics(name);
}
