import { NodeSDK } from "@opentelemetry/sdk-node";
import { SpanContext } from "@opentelemetry/api";
import { logs } from "@opentelemetry/api-logs";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { SimpleLogRecordProcessor, ReadableLogRecord, LogRecordExporter } from "@opentelemetry/sdk-logs";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-proto";
import { Logger } from "./logger.js";

export interface OtelParams {
  endpointTraces?: string;
  endpointMetrics?: string;
  endpointLogs?: string;
  serviceName?: string;
  serviceVersion?: string;
}

export interface InitResult {
  logger: Logger;
  shutdown: () => Promise<void>;
}

export class TracingBuilder {
  private otelParams: OtelParams = {};
  private jsonOutput = true;

  withOtel(value: OtelParams): this {
    this.otelParams = value;
    return this;
  }

  withJson(value: boolean): this {
    this.jsonOutput = value;
    return this;
  }

  async build(): Promise<InitResult> {
    const spanProcessors = [];
    if (this.otelParams.endpointTraces != undefined) {
      spanProcessors.push(new BatchSpanProcessor(
        new OTLPTraceExporter({ url: this.otelParams.endpointTraces })
      ));
    }

    const metricReaders = [];
    if (this.otelParams.endpointMetrics != undefined) {
      metricReaders.push(new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({ url: this.otelParams.endpointMetrics }),
      }));
    }

    const logRecordProcessors = [];
    logRecordProcessors.push(new SimpleLogRecordProcessor(new ConsoleLogExporter(this.jsonOutput)));
    if (this.otelParams.endpointLogs != undefined) {
      logRecordProcessors.push(new SimpleLogRecordProcessor(
        new OTLPLogExporter({ url: this.otelParams.endpointLogs })
      ));
    }

    const sdk = new NodeSDK({
      serviceName: this.otelParams.serviceName ?? "app",
      spanProcessors,
      metricReaders,
      logRecordProcessors,
    });

    sdk.start();

    const loggerName = this.otelParams.serviceName ?? "app";
    const logger = new Logger(logs.getLogger(loggerName));

    return {
      logger,
      shutdown: () => sdk.shutdown(),
    };
  }
}


const ANSI = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
} as const;

function colorLevel(level: string): string {
  const padded = level.padEnd(5);
  switch (level) {
    case "TRACE": return `${ANSI.magenta}${padded}${ANSI.reset}`;
    case "DEBUG": return `${ANSI.blue}${padded}${ANSI.reset}`;
    case "INFO": return `${ANSI.green}${padded}${ANSI.reset}`;
    case "WARN": return `${ANSI.yellow}${padded}${ANSI.reset}`;
    case "ERROR": return `${ANSI.red}${padded}${ANSI.reset}`;
    case "FATAL": return `${ANSI.red}${padded}${ANSI.reset}`;
    default: return padded;
  }
}

function formatBody(body: unknown): string {
  return typeof body === "string" ? body : JSON.stringify(body);
}

function spanIdsFromCtx(ctx: SpanContext): { trace_id: string; span_id: string } {
  return { trace_id: ctx.traceId, span_id: ctx.spanId };
}

function hrTimeToISOString(hrTime: [number, number]): string {
  return new Date(hrTime[0] * 1000 + hrTime[1] / 1e6).toISOString();
}

class ConsoleLogExporter implements LogRecordExporter {
  private readonly json: boolean;

  constructor(json: boolean) {
    this.json = json;
  }

  export(
    records: ReadableLogRecord[],
    resultCallback: (result: { code: number; error?: Error }) => void
  ): void {
    for (const r of records) {
      if (this.json) {
        this.exportJson(r);
      } else {
        this.exportPretty(r);
      }
    }
    resultCallback({ code: 0 });
  }

  private exportJson(r: ReadableLogRecord): void {
    const message = formatBody(r.body);
    const attrs = r.attributes ?? {};
    const ids = r.spanContext ? spanIdsFromCtx(r.spanContext) : {};

    console.log(
      JSON.stringify({
        timestamp: hrTimeToISOString(r.hrTime),
        level: r.severityText ?? "INFO",
        message,
        ...ids,
        ...attrs,
      })
    );
  }

  private exportPretty(r: ReadableLogRecord): void {
    const timestamp = `${ANSI.dim}${hrTimeToISOString(r.hrTime)}${ANSI.reset}`;
    const level = colorLevel(r.severityText ?? "INFO");
    const message = formatBody(r.body);
    const attrs = r.attributes ?? {};
    const ids = r.spanContext ? spanIdsFromCtx(r.spanContext) : {};

    const kvPairs = { ...ids, ...attrs };
    const kvEntries = Object.entries(kvPairs);
    const kvStr = kvEntries.length > 0
      ? "  " + kvEntries.map(([k, v]) => `${ANSI.dim}${k}${ANSI.reset}=${v}`).join(" ")
      : "";

    console.log(`${timestamp}  ${level}  ${message}${kvStr}`);
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

