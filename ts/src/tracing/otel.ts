import { NodeSDK } from "@opentelemetry/sdk-node";
import { Resource } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import {
  BatchLogRecordProcessor,
  LoggerProvider,
} from "@opentelemetry/sdk-logs";
import { logs } from "@opentelemetry/api-logs";
import { propagation } from "@opentelemetry/api";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { PinoInstrumentation } from "@opentelemetry/instrumentation-pino";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
import type { OtelParams } from "./types.js";

export const DEFAULT_ENDPOINTS = {
  traces: "http://localhost:4318/v1/traces",
  metrics: "http://localhost:4318/v1/metrics",
  logs: "http://localhost:4318/v1/logs",
} as const;

export const SHUTDOWN_TIMEOUT_MS = 100;

export interface OtelInstance {
  sdk: NodeSDK;
  loggerProvider: LoggerProvider;
}

export function initializeOtel(params: OtelParams): OtelInstance {
  const { serviceName, serviceVersion } = params;

  propagation.setGlobalPropagator(new W3CTraceContextPropagator());

  const endpointTraces = params.endpointTraces ?? DEFAULT_ENDPOINTS.traces;
  const endpointMetrics = params.endpointMetrics ?? DEFAULT_ENDPOINTS.metrics;
  const endpointLogs = params.endpointLogs ?? DEFAULT_ENDPOINTS.logs;

  const resource = new Resource({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: serviceVersion,
  });

  const traceExporter = new OTLPTraceExporter({ url: endpointTraces });

  const metricReader = new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({ url: endpointMetrics }),
    exportIntervalMillis: getMetricExportInterval(),
  });

  const logExporter = new OTLPLogExporter({ url: endpointLogs });
  const loggerProvider = new LoggerProvider({ resource });
  loggerProvider.addLogRecordProcessor(new BatchLogRecordProcessor(logExporter));
  logs.setGlobalLoggerProvider(loggerProvider);

  const instrumentations = [
    new PinoInstrumentation({
      logHook: (_span: unknown, record: Record<string, unknown>) => {
        record["otel.instrumented"] = true;
      },
    }),
    new HttpInstrumentation(),
    new PgInstrumentation(),
  ];

  const sdk = new NodeSDK({
    resource,
    instrumentations,
    traceExporter,
    metricReader,
  });

  sdk.start();

  return { sdk, loggerProvider };
}

export async function shutdownOtel(instance: OtelInstance): Promise<void> {
  const { sdk, loggerProvider } = instance;

  const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
    Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error("Shutdown timeout")), ms)
      ),
    ]);

  try {
    await withTimeout(loggerProvider.forceFlush(), SHUTDOWN_TIMEOUT_MS);
    await withTimeout(loggerProvider.shutdown(), SHUTDOWN_TIMEOUT_MS);
  } catch {}

  try {
    await withTimeout(sdk.shutdown(), SHUTDOWN_TIMEOUT_MS);
  } catch {}
}

const DEFAULT_METRIC_EXPORT_INTERVAL_MS = 60000;

function getMetricExportInterval(): number {
  const envInterval = process.env["OTEL_METRIC_EXPORT_INTERVAL"];
  if (envInterval) {
    const parsed = parseInt(envInterval, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_METRIC_EXPORT_INTERVAL_MS;
}
