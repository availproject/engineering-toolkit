### Metrics
Use metrics to:
- Monitor system health
- Set up alerts when something breaks
- Track performance over time
- Support capacity planning
- Measure SLIs and SLOs

Typical examples include request volume, error rate, response times, CPU and memory usage, and queue depth.

Good metrics are usually:
- Easy to aggregate (you can sum, average, or count them)
- Stable over time
- Low in cardinality (not too many unique values)
- Actionable (you know what to do when they change)

If a metric does not help you make a decision or trigger an action, it is probably not very useful.

Common metric types are:
- Counter: A value that only goes up. Examples: total requests, total errors.
- Gauge: A value that goes up and down. Examples: memory usage, active users, open connections.
- Histogram: Used to understand distributions. Examples: request latency, payload sizes.

Rule of thumb: Metrics tell you that something is wrong. Logs and traces help you understand why.


### Metric Attributes
Use it to break down metrics by meaningful, low-cardinality dimensions.
Use attributes when values are:
- Low-cardinality (few possible values)
- Stable
- Useful for filtering/aggregation

Good examples:
- `http.method = GET, POST`
- `status_code = 200, 500`
- `db.system = postgres, mysql`
- `region = eu-west, us-east`
- `cache.hit = true/false`

Avoid attributes when values are:
- High-cardinality
- Highly unique per event

Bad examples:
- `user_id`
- `email`
- `session_id`
- `order_id`
- `trace_id`
- full dynamic URLs

Rule of thumb: If you wouldn’t reasonably group or alert on it, don’t make it a metric attribute.  


Example:
```rust
use opentelemetry::KeyValue;

counter.add(
    1,
    &[
        KeyValue::new("method", "GET"),
        KeyValue::new("status_code", "500"),
    ],
);
```