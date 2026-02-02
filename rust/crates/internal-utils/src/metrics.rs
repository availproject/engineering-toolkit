#[cfg(feature = "otel")]
use opentelemetry::{
    KeyValue,
    metrics::{Counter, Histogram},
};

#[cfg(feature = "otel")]
pub struct MetricsHelper {}
#[cfg(feature = "otel")]
impl MetricsHelper {
    pub fn http_request_counter(meter: &opentelemetry::metrics::Meter) -> Counter<u64> {
        meter
            .u64_counter("http.server.request.total")
            .with_description("Total number of HTTP requests")
            .with_unit("1")
            .build()
    }

    pub fn http_request_duration(meter: &opentelemetry::metrics::Meter) -> Histogram<u64> {
        meter
            .u64_histogram("http.server.request.duration")
            .with_description("HTTP request duration")
            .with_unit("ms")
            .with_boundaries(vec![
                5.0, 10.0, 25.0, 50.0, 100.0, 250.0, 500.0, 1000.0, 2500.0, 5000.0, 10000.0,
            ])
            .build()
    }

    pub fn db_operation_counter(meter: &opentelemetry::metrics::Meter) -> Counter<u64> {
        meter
            .u64_counter("db.client.operation.total")
            .with_description("Total number of database operations")
            .with_unit("1")
            .build()
    }

    pub fn db_operation_duration(meter: &opentelemetry::metrics::Meter) -> Histogram<u64> {
        meter
            .u64_histogram("db.client.operation.duration")
            .with_description("Database operation duration")
            .with_unit("ms")
            .with_boundaries(vec![
                5.0, 10.0, 25.0, 50.0, 100.0, 250.0, 500.0, 1000.0, 2500.0, 5000.0, 10000.0,
            ])
            .build()
    }
}

#[cfg(feature = "otel")]
pub trait IntoOtelAttributes {
    fn into_attributes(&self) -> Vec<KeyValue>;
}

#[derive(Debug, Clone)]
pub struct HttpRequestMetrics {
    pub method: String,
    pub route: String,
    pub status_code: u16,
    pub error: Option<String>,
    pub extra: Vec<(String, String)>,
    pub duration_ms: Option<u64>,
}

impl HttpRequestMetrics {
    pub fn new() -> Self {
        Self {
            method: "GET".to_owned(),
            route: String::from(""),
            status_code: 200,
            error: None,
            extra: Vec::new(),
            duration_ms: None,
        }
    }

    pub fn get(mut self) -> Self {
        self.method = "GET".to_owned();
        self
    }

    pub fn post(mut self) -> Self {
        self.method = "POST".to_owned();
        self
    }

    pub fn put(mut self) -> Self {
        self.method = "PUT".to_owned();
        self
    }

    pub fn delete(mut self) -> Self {
        self.method = "DELETE".to_owned();
        self
    }

    pub fn patch(mut self) -> Self {
        self.method = "PATCH".to_owned();
        self
    }

    /// Code 200
    pub fn ok(mut self) -> Self {
        self.status_code = 200;
        self
    }

    /// Code 400
    pub fn bad_request(mut self) -> Self {
        self.status_code = 400;
        self
    }

    /// Code 409
    pub fn conflict(mut self) -> Self {
        self.status_code = 409;
        self
    }

    /// Code 500
    pub fn internal_server_error(mut self) -> Self {
        self.status_code = 500;
        self
    }

    pub fn route(mut self, value: impl Into<String>) -> Self {
        self.route = value.into();
        self
    }

    pub fn status_code(mut self, value: u16) -> Self {
        self.status_code = value;
        self
    }

    pub fn error(mut self, value: impl Into<String>) -> Self {
        self.error = Some(value.into());
        self
    }

    pub fn extra(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.extra.push((key.into(), value.into()));
        self
    }

    /// Duration in ms
    pub fn duration(mut self, value: u64) -> Self {
        self.duration_ms = Some(value);
        self
    }
}

#[cfg(feature = "otel")]
impl IntoOtelAttributes for HttpRequestMetrics {
    fn into_attributes(&self) -> Vec<opentelemetry::KeyValue> {
        let mut attrs = vec![
            opentelemetry::KeyValue::new("http.request.method", self.method.clone()),
            opentelemetry::KeyValue::new("http.route", self.route.clone()),
            opentelemetry::KeyValue::new("http.response.status_code", self.status_code as i64),
        ];

        if let Some(error) = &self.error {
            attrs.push(opentelemetry::KeyValue::new("error.type", error.clone()));
        }

        for extra in self.extra.iter() {
            attrs.push(opentelemetry::KeyValue::new(
                extra.0.clone(),
                extra.1.clone(),
            ));
        }

        attrs
    }
}
