// Run: cd signoz/deploy/docker/clickhouse-setup && docker compose up -d
// Run: cargo run --example tracing_example

use internal_utils::{
    TracingBuilder, TracingOtelParams, info, warn, error, otel_meter,
    opentelemetry::KeyValue,
};
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
        Self { message: message.into(), code: code.into() }
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
async fn create_order(request: CreateOrderRequest) -> Result<CreateOrderResponse, ApiError> {
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
        return Err(ApiError::new("Order must have at least one item", "invalid_request"));
    }

    if request.total <= 0.0 {
        warn!(
            otel.name = "order.create.discarded",
            reason = "invalid_total",
            order.total = request.total,
            "Order total must be positive"
        );
        return Err(ApiError::new("Order total must be positive", "invalid_request"));
    }

    match process_order(&order_id, &request).await {
        Ok(()) => {
            info!(
                otel.name = "order.create.success",
                order.id = %order_id,
                "Order created successfully"
            );
            Ok(CreateOrderResponse { order_id })
        }
        Err(e) => {
            error!(
                otel.name = "order.create.failed",
                error.code = "ORDER_PROCESSING_FAILED",
                error.details = %e,
                "Failed to process order"
            );
            Err(ApiError::new(e, "internal_error"))
        }
    }
}

#[tracing::instrument(name = "order.process", skip_all, fields(order.id = %order_id))]
async fn process_order(order_id: &str, request: &CreateOrderRequest) -> Result<(), String> {
    info!(otel.name = "order.process.start", "Processing order");
    
    tokio::time::sleep(Duration::from_millis(50)).await;
    
    if request.total > 10000.0 {
        return Err("Amount exceeds limit".to_string());
    }
    
    info!(otel.name = "order.process.complete", "Order processing complete");
    Ok(())
}

fn record_metrics(success: bool, duration_ms: u64) {
    let meter = otel_meter("order-service");
    
    let counter = meter.u64_counter("orders_total").build();
    counter.add(1, &[
        KeyValue::new("status", if success { "success" } else { "error" }),
    ]);
    
    let histogram = meter.f64_histogram("order_duration_ms").build();
    histogram.record(duration_ms as f64, &[]);
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
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
        let start = std::time::Instant::now();
        let result = create_order(request).await;
        let duration = start.elapsed().as_millis() as u64;
        
        record_metrics(result.is_ok(), duration);
        
        tokio::time::sleep(Duration::from_millis(100)).await;
    }

    info!(otel.name = "service.stop", "Order service stopping");
    
    tokio::time::sleep(Duration::from_secs(6)).await;
    
    Ok(())
}
