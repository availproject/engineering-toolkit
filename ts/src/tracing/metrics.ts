import { metrics, type Counter, type Histogram, type Attributes } from "@opentelemetry/api";
import {
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_HTTP_ROUTE,
  ATTR_DB_OPERATION_NAME,
  ATTR_ERROR_TYPE,
} from "@opentelemetry/semantic-conventions";

const ATTR_DB_SYSTEM = "db.system" as const;

export interface HttpRequestOptions {
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
  attributes?: Attributes;
}

export interface DbQueryOptions {
  system: string;
  operation: string;
  durationMs: number;
  success: boolean;
  attributes?: Attributes;
}

export class MetricsHelper {
  private readonly meter;
  private readonly httpRequestCounter: Counter;
  private readonly httpRequestDuration: Histogram;
  private readonly dbQueryCounter: Counter;
  private readonly dbQueryDuration: Histogram;

  constructor(serviceName: string) {
    this.meter = metrics.getMeter(serviceName);

    this.httpRequestCounter = this.meter.createCounter("http.server.request.total", {
      description: "Total number of HTTP requests",
      unit: "1",
    });

    this.httpRequestDuration = this.meter.createHistogram("http.server.request.duration", {
      description: "HTTP request duration",
      unit: "ms",
    });

    this.dbQueryCounter = this.meter.createCounter("db.client.operation.total", {
      description: "Total number of database operations",
      unit: "1",
    });

    this.dbQueryDuration = this.meter.createHistogram("db.client.operation.duration", {
      description: "Database operation duration",
      unit: "ms",
    });
  }

  recordHttpRequest(options: HttpRequestOptions): void {
    const attrs: Attributes = {
      [ATTR_HTTP_REQUEST_METHOD]: options.method,
      [ATTR_HTTP_ROUTE]: options.route,
      [ATTR_HTTP_RESPONSE_STATUS_CODE]: options.statusCode,
      ...options.attributes,
    };

    this.httpRequestCounter.add(1, attrs);
    this.httpRequestDuration.record(options.durationMs, attrs);
  }

  recordDbQuery(options: DbQueryOptions): void {
    const attrs: Attributes = {
      [ATTR_DB_SYSTEM]: options.system,
      [ATTR_DB_OPERATION_NAME]: options.operation,
      ...(options.success ? {} : { [ATTR_ERROR_TYPE]: "db_error" }),
      ...options.attributes,
    };

    this.dbQueryCounter.add(1, attrs);
    this.dbQueryDuration.record(options.durationMs, attrs);
  }

  counter(name: string, options?: { description?: string; unit?: string }): Counter {
    return this.meter.createCounter(name, {
      ...(options?.description && { description: options.description }),
      unit: options?.unit ?? "1",
    });
  }

  histogram(name: string, options?: { description?: string; unit?: string }): Histogram {
    return this.meter.createHistogram(name, {
      ...(options?.description && { description: options.description }),
      ...(options?.unit && { unit: options.unit }),
    });
  }

  upDownCounter(name: string, options?: { description?: string; unit?: string }) {
    return this.meter.createUpDownCounter(name, {
      ...(options?.description && { description: options.description }),
      unit: options?.unit ?? "1",
    });
  }

  gauge(
    name: string,
    callback: () => number,
    options?: { description?: string; unit?: string; attributes?: Attributes }
  ) {
    return this.meter.createObservableGauge(name, {
      ...(options?.description && { description: options.description }),
      ...(options?.unit && { unit: options.unit }),
    }).addCallback((result) => {
      result.observe(callback(), options?.attributes ?? {});
    });
  }
}

export function createMetricsHelper(serviceName: string): MetricsHelper {
  return new MetricsHelper(serviceName);
}
