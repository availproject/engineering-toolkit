pub mod metrics;

use std::error::Error;
use std::fs::File;
pub use tracing::{
    debug, debug_span, error, error_span, event, info, info_span, trace, trace_span, warn,
    warn_span,
};
use tracing_subscriber::EnvFilter;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;

#[cfg(feature = "otel")]
use opentelemetry::trace::TracerProvider;
#[cfg(feature = "otel")]
use opentelemetry_otlp::WithExportConfig;
#[cfg(feature = "otel")]
use opentelemetry_sdk::logs::SdkLoggerProvider;
#[cfg(feature = "otel")]
use opentelemetry_sdk::metrics::SdkMeterProvider;
#[cfg(feature = "otel")]
use opentelemetry_sdk::propagation::TraceContextPropagator;
#[cfg(feature = "otel")]
use opentelemetry_sdk::trace::SdkTracerProvider;

#[cfg(feature = "otel")]
pub use opentelemetry;
#[cfg(feature = "otel")]
pub use opentelemetry_appender_tracing;
#[cfg(feature = "otel")]
pub use opentelemetry_otlp;
#[cfg(feature = "otel")]
pub use opentelemetry_sdk;
#[cfg(feature = "otel")]
pub use opentelemetry_semantic_conventions;

#[cfg(feature = "db")]
pub use sqlx;

#[cfg(feature = "openapi")]
pub use utoipa;
#[cfg(feature = "openapi")]
pub use utoipa_axum;

#[cfg(feature = "otel")]
pub use metrics::{HttpRequestMetrics, IntoOtelAttributes, MetricsHelper};

pub use tracing;
pub use tracing_subscriber;

#[derive(Default)]
pub struct TracingGuards {
    #[cfg(feature = "otel")]
    otel_tracer: Option<SdkTracerProvider>,
    #[cfg(feature = "otel")]
    otel_meter: Option<SdkMeterProvider>,
    #[cfg(feature = "otel")]
    otel_logger: Option<SdkLoggerProvider>,
}

impl Drop for TracingGuards {
    fn drop(&mut self) {
        #[cfg(feature = "otel")]
        {
            use std::time::Duration;

            if let Some(tracer) = &self.otel_tracer {
                _ = tracer.force_flush();
                _ = tracer.shutdown_with_timeout(Duration::from_millis(100));
            }
            if let Some(meter) = &self.otel_meter {
                _ = meter.force_flush();
                _ = meter.shutdown_with_timeout(Duration::from_millis(100));
            }
            if let Some(logger) = &self.otel_logger {
                _ = logger.force_flush();
                _ = logger.shutdown_with_timeout(Duration::from_millis(100));
            }
        }
    }
}

#[cfg(feature = "otel")]
#[derive(Debug, Clone)]
pub struct TracingOtelParams {
    pub endpoint_traces: Option<String>,
    pub endpoint_metrics: Option<String>,
    pub endpoint_logs: Option<String>,
    pub service_name: String,
    pub service_version: String,
}

#[cfg(feature = "otel")]
impl Default for TracingOtelParams {
    fn default() -> Self {
        Self {
            endpoint_traces: Some("http://localhost:4318/v1/traces".into()),
            endpoint_metrics: Some("http://localhost:4318/v1/metrics".into()),
            endpoint_logs: Some("http://localhost:4318/v1/logs".into()),
            service_name: env!("CARGO_CRATE_NAME").into(),
            service_version: env!("CARGO_PKG_VERSION").into(),
        }
    }
}

pub struct TracingBuilder {
    json: Option<bool>,
    stdout: Option<bool>,
    file: Option<String>,
    env_filter: Option<EnvFilter>,
    #[cfg(feature = "otel")]
    otel: Option<TracingOtelParams>,
}

impl Default for TracingBuilder {
    fn default() -> Self {
        Self {
            json: Some(true),
            stdout: Some(true),
            file: None,
            env_filter: None,
            #[cfg(feature = "otel")]
            otel: Default::default(),
        }
    }
}

impl TracingBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_stdout(mut self, value: bool) -> Self {
        self.stdout = Some(value);
        self
    }

    pub fn with_env_filter(mut self, value: Option<EnvFilter>) -> Self {
        self.env_filter = value;
        self
    }

    pub fn with_json(mut self, value: Option<bool>) -> Self {
        self.json = value;
        self
    }

    pub fn with_file(mut self, path: Option<String>) -> Self {
        self.file = path;
        self
    }

    #[cfg(feature = "otel")]
    pub fn with_otel(mut self, otel: TracingOtelParams) -> Self {
        self.otel = Some(otel);
        self
    }

    pub fn with_predefined_file(mut self) -> Self {
        self.file = Some("./log.txt".to_owned());
        self
    }

    pub fn with_rust_log(self, value: &str) -> Self {
        unsafe {
            std::env::set_var("RUST_LOG", value);
        }

        self
    }

    /// in ms
    #[cfg(feature = "otel")]
    pub fn with_otel_metric_export_interval(self, value: &str) -> Self {
        unsafe {
            std::env::set_var("OTEL_METRIC_EXPORT_INTERVAL", value);
        }
        self
    }

    pub fn try_init(self) -> Result<TracingGuards, Box<dyn Error + Send + Sync>> {
        use tracing_subscriber::Layer;
        use tracing_subscriber::fmt::layer;

        let json = self.json.unwrap_or(true);
        let stdout = self.stdout.unwrap_or(true);
        #[allow(unused_mut)]
        let mut guard = TracingGuards::default();
        let mut layers = Vec::new();

        if let Some(file) = self.file {
            let file = File::create(&file)?;
            let layer = layer().with_ansi(false).with_writer(file);
            if json {
                layers.push(layer.json().boxed());
            } else {
                layers.push(layer.boxed());
            }
        };

        if stdout {
            let layer = layer();
            if json {
                layers.push(layer.json().boxed());
            } else {
                layers.push(layer.boxed());
            }
        }

        #[cfg(feature = "otel")]
        if let Some(otel_params) = self.otel {
            use opentelemetry_semantic_conventions::resource::{SERVICE_NAME, SERVICE_VERSION};
            opentelemetry::global::set_text_map_propagator(TraceContextPropagator::new());

            // Trace
            let resource = opentelemetry_sdk::Resource::builder()
                .with_attributes(vec![
                    opentelemetry::KeyValue::new(SERVICE_NAME, otel_params.service_name.clone()),
                    opentelemetry::KeyValue::new(
                        SERVICE_VERSION,
                        otel_params.service_version.clone(),
                    ),
                ])
                .build();

            if let Some(endpoint) = otel_params.endpoint_traces {
                let exporter = opentelemetry_otlp::SpanExporter::builder()
                    .with_http()
                    .with_endpoint(endpoint)
                    .build()?;
                // Create a tracer provider with the exporter
                let tracer_provider = opentelemetry_sdk::trace::SdkTracerProvider::builder()
                    .with_batch_exporter(exporter)
                    .with_resource(resource.clone())
                    .build();
                let tracer = tracer_provider.tracer(otel_params.service_name);
                opentelemetry::global::set_tracer_provider(tracer_provider.clone());
                layers.push(tracing_opentelemetry::layer().with_tracer(tracer).boxed());
                guard.otel_tracer = Some(tracer_provider);
            }

            if let Some(endpoint) = otel_params.endpoint_metrics {
                // Metrics
                let exporter = opentelemetry_otlp::MetricExporter::builder()
                    .with_http()
                    .with_endpoint(endpoint)
                    .build()?;
                let meter_provider = SdkMeterProvider::builder()
                    .with_resource(resource.clone())
                    .with_periodic_exporter(exporter)
                    .build();
                opentelemetry::global::set_meter_provider(meter_provider.clone());
                guard.otel_meter = Some(meter_provider);
            }

            if let Some(endpoint) = otel_params.endpoint_logs {
                // Logs
                let exporter = opentelemetry_otlp::LogExporter::builder()
                    .with_http()
                    .with_endpoint(endpoint)
                    .build()?;
                let log_provider = SdkLoggerProvider::builder()
                    .with_resource(resource.clone())
                    .with_batch_exporter(exporter)
                    .build();
                layers.push(
                    opentelemetry_appender_tracing::layer::OpenTelemetryTracingBridge::new(
                        &log_provider,
                    )
                    .boxed(),
                );
                guard.otel_logger = Some(log_provider);
            }
        }

        tracing_subscriber::registry()
            .with(
                self.env_filter
                    .unwrap_or_else(|| EnvFilter::from_default_env()),
            )
            .with(layers)
            .try_init()?;

        Ok(guard)
    }
}

#[cfg(feature = "otel")]
pub fn otel_meter(service_name: &'static str) -> opentelemetry::metrics::Meter {
    opentelemetry::global::meter(service_name)
}

#[cfg(feature = "db")]
pub struct Db;

#[cfg(feature = "db")]
impl Db {
    /// max_connections if None defaults to 5
    pub async fn initialize(
        url: &str,
        max_connections: Option<u32>,
    ) -> Result<sqlx::Pool<sqlx::Postgres>, sqlx::Error> {
        sqlx::postgres::PgPoolOptions::new()
            .max_connections(max_connections.unwrap_or(5))
            .connect(url)
            .await
    }
}

#[cfg(test)]
pub mod test {
    use crate::{TracingBuilder, debug, error, info, otel_meter, trace, warn};
    use std::{thread::sleep, time::Duration};

    #[test]
    pub fn tracing_works() {
        let _guards = TracingBuilder::new()
            .with_predefined_file()
            .with_json(Some(false))
            .with_rust_log("info")
            .with_otel_metric_export_interval("10000")
            .with_otel(crate::TracingOtelParams {
                endpoint_traces: Some("http://localhost:4318/v1/traces".into()),
                endpoint_metrics: Some("http://localhost:4318/v1/metrics".into()),
                endpoint_logs: Some("http://localhost:4318/v1/logs".into()),
                service_name: "markos-service".into(),
                service_version: "0.12.0".into(),
            })
            .try_init()
            .unwrap();
        trace!(target: "test", "Trace");
        info!(target: "test", "This is Info Event");
        warn!(target: "test", "This is Warn Event");
        debug!(target: "test", "Debug");
        error!(target: "test", "This is Error Event");

        {
            let span = tracing::info_span!("test_root_span");
            let _g = span.enter();
            tracing::info!("inside span");
        }

        let meter = otel_meter("markos-service");
        let c = meter.u64_counter("Example").build();
        c.add(
            1,
            &[
                opentelemetry::KeyValue::new("name", "apple"),
                opentelemetry::KeyValue::new("color", "green"),
            ],
        );
        c.add(
            2,
            &[
                opentelemetry::KeyValue::new("name", "apple"),
                opentelemetry::KeyValue::new("color", "red"),
            ],
        );
        sleep(Duration::from_secs(60));
    }

    #[test]
    pub fn use_external_metrics() {
        let _guards = TracingBuilder::new()
            .with_predefined_file()
            .with_json(Some(false))
            .with_rust_log("info")
            .with_otel_metric_export_interval("10000")
            .with_otel(crate::TracingOtelParams {
                endpoint_traces: Some("http://localhost:4318/v1/traces".into()),
                endpoint_metrics: Some("http://localhost:4318/v1/metrics".into()),
                endpoint_logs: Some("http://localhost:4318/v1/logs".into()),
                service_name: "markos-service".into(),
                service_version: "0.12.0".into(),
            })
            .try_init()
            .unwrap();

        let meter = otel_meter("markos-service");
        let _c = meter
            .u64_observable_counter("NotExample")
            .with_callback(|x| {
                // This would be an external metrics stored somewhere in our codebase.
                x.observe(
                    1,
                    &[
                        opentelemetry::KeyValue::new("name", "apple"),
                        opentelemetry::KeyValue::new("color", "green"),
                    ],
                )
            })
            .build();
    }

    #[test]
    pub fn test_basic_logging() {
        let _guards = TracingBuilder::new()
            .with_rust_log("info")
            .with_json(Some(false))
            .try_init()
            .unwrap();

        let reason = "No Reason";
        let code = "200";
        tracing::event!(target: "my-service", tracing::Level::INFO, reason, code_debug = ?code, code_display = %code, "HTTP Fetch Failed");
        tracing::info!(target: "my-service", reason, code_debug = ?code, code_display = %code, "HTTP Fetch Failed");
    }
}
