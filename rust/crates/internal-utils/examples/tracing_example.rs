// Run: cd signoz/deploy/docker/clickhouse-setup && docker compose up -d
// Run: cargo run --example tracing_example

use internal_utils::HttpRequestMetrics;
use internal_utils::{IntoOtelAttributes, TracingBuilder, TracingOtelParams, error, info, warn};
use std::time::Duration;

#[derive(Debug)]
struct CreateOrderRequest {
    user_id: String,
    items: Vec<String>,
    total: f64,
}

#[derive(Debug)]
struct CreateOrderResponse {
    order_id: String,
}

#[derive(Debug)]
struct ApiError {
    message: String,
    code: String,
}

impl ApiError {
    fn new(message: impl Into<String>, code: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            code: code.into(),
        }
    }
}

#[cfg(feature = "otel")]
pub struct Metrics {
    http_request_counter: opentelemetry::metrics::Counter<u64>,
    http_request_duration: opentelemetry::metrics::Histogram<u64>,
    db_query_counter: opentelemetry::metrics::Counter<u64>,
    db_query_duration: opentelemetry::metrics::Histogram<u64>,
    meter: opentelemetry::metrics::Meter,
}

#[cfg(feature = "otel")]
pub struct DbQueryMetrics {
    pub system: String,
    pub operation: String,
    pub duration_ms: u64,
    pub success: bool,
}

#[cfg(feature = "otel")]
impl IntoOtelAttributes for DbQueryMetrics {
    fn into_attributes(&self) -> Vec<opentelemetry::KeyValue> {
        let mut attrs = vec![
            opentelemetry::KeyValue::new("db.system", self.system.clone()),
            opentelemetry::KeyValue::new("db.operation.name", self.operation.clone()),
        ];

        if !self.success {
            attrs.push(opentelemetry::KeyValue::new("error.type", "db_error"));
        }

        Vec::from(attrs)
    }
}
#[cfg(feature = "otel")]
impl Metrics {
    pub fn new(service_name: &'static str) -> Self {
        use internal_utils::MetricsHelper;

        let meter = opentelemetry::global::meter(service_name);

        let http_request_counter = MetricsHelper::http_request_counter(&meter);
        let http_request_duration = MetricsHelper::http_request_duration(&meter);
        let db_query_counter = MetricsHelper::db_operation_counter(&meter);
        let db_query_duration = MetricsHelper::db_operation_duration(&meter);

        Self {
            http_request_counter,
            http_request_duration,
            db_query_counter,
            db_query_duration,
            meter,
        }
    }

    pub fn record_http_request(&self, metrics: HttpRequestMetrics) {
        let attrs = metrics.into_attributes();

        self.http_request_counter.add(1, &attrs);
        if let Some(duration) = metrics.duration_ms {
            self.http_request_duration.record(duration, &attrs);
        }
    }

    pub fn record_db_query(&self, metrics: DbQueryMetrics) {
        let attrs = metrics.into_attributes();
        self.db_query_counter.add(1, &attrs);
        self.db_query_duration.record(metrics.duration_ms, &attrs);
    }

    pub fn counter(&self, name: &'static str) -> opentelemetry::metrics::Counter<u64> {
        self.meter.u64_counter(name).build()
    }

    pub fn histogram(&self, name: &'static str) -> opentelemetry::metrics::Histogram<f64> {
        self.meter.f64_histogram(name).build()
    }

    pub fn up_down_counter(
        &self,
        name: &'static str,
    ) -> opentelemetry::metrics::UpDownCounter<i64> {
        self.meter.i64_up_down_counter(name).build()
    }
}

#[tracing::instrument(
    name = "http.request",
    skip_all,
    fields(
        http.method = "POST",
        http.route = "/orders"
    )
)]
async fn create_order(
    request: CreateOrderRequest,
    metrics: &Metrics,
) -> Result<CreateOrderResponse, ApiError> {
    let start = std::time::Instant::now();
    let order_id = format!("ord_{}", uuid::Uuid::new_v4());

    info!(
        otel.name = "order.create",
        order.id = %order_id,
        user.id = %request.user_id,
        "Creating new order"
    );

    if request.items.is_empty() {
        warn!(
            otel.name = "order.create.discarded",
            reason = "no_items",
            "Order must have at least one item"
        );
        metrics.record_http_request(HttpRequestMetrics {
            method: "POST".into(),
            route: "/orders".into(),
            status_code: 400,
            duration_ms: Some(start.elapsed().as_millis() as u64),
            error: None,
            extra: Vec::new(),
        });
        return Err(ApiError::new(
            "Order must have at least one item",
            "invalid_request",
        ));
    }

    if request.total <= 0.0 {
        warn!(
            otel.name = "order.create.discarded",
            reason = "invalid_total",
            order.total = request.total,
            "Order total must be positive"
        );
        metrics.record_http_request(HttpRequestMetrics {
            method: "POST".into(),
            route: "/orders".into(),
            status_code: 400,
            duration_ms: Some(start.elapsed().as_millis() as u64),
            error: None,
            extra: Vec::new(),
        });
        return Err(ApiError::new(
            "Order total must be positive",
            "invalid_request",
        ));
    }

    match process_order(&order_id, &request, metrics).await {
        Ok(()) => {
            info!(
                otel.name = "order.create.success",
                order.id = %order_id,
                "Order created successfully"
            );
            metrics.record_http_request(HttpRequestMetrics {
                method: "POST".into(),
                route: "/orders".into(),
                status_code: 201,
                duration_ms: Some(start.elapsed().as_millis() as u64),
                error: None,
                extra: Vec::new(),
            });
            Ok(CreateOrderResponse { order_id })
        }
        Err(e) => {
            error!(
                otel.name = "order.create.failed",
                error.code = "ORDER_PROCESSING_FAILED",
                error.details = %e,
                "Failed to process order"
            );
            metrics.record_http_request(HttpRequestMetrics {
                method: "POST".into(),
                route: "/orders".into(),
                status_code: 500,
                duration_ms: Some(start.elapsed().as_millis() as u64),
                error: None,
                extra: Vec::new(),
            });
            Err(ApiError::new(e, "internal_error"))
        }
    }
}

#[tracing::instrument(name = "order.process", skip_all, fields(order.id = %order_id))]
async fn process_order(
    order_id: &str,
    request: &CreateOrderRequest,
    metrics: &Metrics,
) -> Result<(), String> {
    info!(otel.name = "order.process.start", "Processing order");

    let start = std::time::Instant::now();
    tokio::time::sleep(Duration::from_millis(50)).await;

    if request.total > 10000.0 {
        metrics.record_db_query(DbQueryMetrics {
            system: "postgresql".into(),
            operation: "INSERT".into(),
            duration_ms: start.elapsed().as_millis() as u64,
            success: false,
        });
        return Err("Amount exceeds limit".to_string());
    }

    metrics.record_db_query(DbQueryMetrics {
        system: "postgresql".into(),
        operation: "INSERT".into(),
        duration_ms: start.elapsed().as_millis() as u64,
        success: true,
    });

    info!(
        otel.name = "order.process.complete",
        "Order processing complete"
    );
    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let _guards = TracingBuilder::new()
        .with_rust_log("info")
        .with_json(Some(false))
        .with_otel_metric_export_interval("5000")
        .with_otel(TracingOtelParams {
            endpoint_traces: Some("http://localhost:4318/v1/traces".into()),
            endpoint_metrics: Some("http://localhost:4318/v1/metrics".into()),
            endpoint_logs: Some("http://localhost:4318/v1/logs".into()),
            service_name: "order-service".into(),
            service_version: "1.0.0".into(),
        })
        .try_init()?;

    let metrics = Metrics::new("order-service");

    info!(otel.name = "service.start", "Order service started");

    let requests = vec![
        CreateOrderRequest {
            user_id: "user_123".into(),
            items: vec!["item_1".into(), "item_2".into()],
            total: 99.99,
        },
        CreateOrderRequest {
            user_id: "user_456".into(),
            items: vec![],
            total: 50.0,
        },
        CreateOrderRequest {
            user_id: "user_789".into(),
            items: vec!["item_3".into()],
            total: 15000.0,
        },
    ];

    for request in requests {
        let _ = create_order(request, &metrics).await;
        tokio::time::sleep(Duration::from_millis(100)).await;
    }

    info!(otel.name = "service.stop", "Order service stopping");

    tokio::time::sleep(Duration::from_secs(6)).await;

    Ok(())
}
