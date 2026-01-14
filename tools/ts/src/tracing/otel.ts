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
import { PinoInstrumentation } from "@opentelemetry/instrumentation-pino";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
import type { OtelParams } from "./types.js";

/**
 * OpenTelemetry SDK instance and associated resources.
 */
export interface OtelInstance {
  sdk: NodeSDK;
  loggerProvider?: LoggerProvider | undefined;
}

/**
 * Initializes OpenTelemetry with the provided configuration.
 *
 * @param params - OpenTelemetry configuration parameters
 * @returns Initialized OpenTelemetry instance
 */
export function initializeOtel(params: OtelParams): OtelInstance {
  const { serviceName, serviceVersion, endpointTraces, endpointMetrics, endpointLogs } =
    params;

  // Create resource with service information
  const resource = new Resource({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: serviceVersion,
  });

  // Configure trace exporter if endpoint provided
  const traceExporter = endpointTraces
    ? new OTLPTraceExporter({ url: endpointTraces })
    : undefined;

  // Configure metric reader if endpoint provided
  const metricReader = endpointMetrics
    ? new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({ url: endpointMetrics }),
        exportIntervalMillis: getMetricExportInterval(),
      })
    : undefined;

  // Configure log provider if endpoint provided
  let loggerProvider: LoggerProvider | undefined;
  if (endpointLogs) {
    const logExporter = new OTLPLogExporter({ url: endpointLogs });
    loggerProvider = new LoggerProvider({ resource });
    loggerProvider.addLogRecordProcessor(
      new BatchLogRecordProcessor(logExporter)
    );
    logs.setGlobalLoggerProvider(loggerProvider);
  }

  // Create instrumentations
  const instrumentations = [
    new PinoInstrumentation({
      // Inject trace context into log records
      logHook: (_span, record) => {
        // Add custom attributes to logs if needed
        record["otel.instrumented"] = true;
      },
    }),
    new HttpInstrumentation(),
    new PgInstrumentation(),
  ];

  // Build SDK configuration
  const sdkConfig: ConstructorParameters<typeof NodeSDK>[0] = {
    resource,
    instrumentations,
  };

  if (traceExporter) {
    sdkConfig.traceExporter = traceExporter;
  }

  if (metricReader) {
    sdkConfig.metricReader = metricReader;
  }

  // Create and start the SDK
  const sdk = new NodeSDK(sdkConfig);

  sdk.start();

  return { sdk, loggerProvider };
}

/**
 * Gracefully shuts down the OpenTelemetry SDK.
 * Flushes all pending telemetry before returning.
 *
 * @param instance - OpenTelemetry instance to shutdown
 */
export async function shutdownOtel(instance: OtelInstance): Promise<void> {
  const { sdk, loggerProvider } = instance;

  // Shutdown logger provider first to flush logs
  if (loggerProvider) {
    try {
      await loggerProvider.forceFlush();
      await loggerProvider.shutdown();
    } catch (error) {
      console.error("Error shutting down logger provider:", error);
    }
  }

  // Shutdown SDK (handles traces and metrics)
  try {
    await sdk.shutdown();
  } catch (error) {
    console.error("Error shutting down OpenTelemetry SDK:", error);
  }
}

/**
 * Gets the metric export interval from environment or default.
 */
function getMetricExportInterval(): number {
  const envInterval = process.env["OTEL_METRIC_EXPORT_INTERVAL"];
  if (envInterval) {
    const parsed = parseInt(envInterval, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 60000; // Default: 60 seconds
}
