# Tracing & Distributed Traces: Naming + Conventions (Rust `tracing`)

These conventions align with modern distributed tracing expectations (OpenTelemetry-style), and will work cleanly across most vendors/backends.

---

#### 1) Service name

**Goal:** stable identifier of the service producing telemetry.

**Convention**
- lowercase
- kebab-case
- **environment-agnostic**
- stable over time

**Good**
- `auth-service`
- `user-api`
- `billing-worker`
- `checkout-backend`

**Bad**
- `AuthService`
- `user-api-prod` (env should be separate)
- `backend-123` (changes / not meaningful)

**Rust example (as a log field)**
```rust
info!(service.name="checkout-api", service.version="1.7.3", deployment.environment="production", "service boot");
```

#### 2) Span name (operation name)
Goal: human-readable, low-cardinality operation identifier.

Convention
- `<OPERATION>` `<RESOURCE>`
- For HTTP: METHOD /route/{param}
- Avoid embedding raw IDs in names (/users/123) → high cardinality

Good
- GET /users/{id}
- POST /checkout
- SELECT users
- SEND order.created

Bad
- GET /users/839201
- doStuff
- handleRequest123

> With tracing, span names usually come from info_span!(). Here we focus on info!() lines only, but keep the naming rule above for span names.

#### 3) Trace messages (events)

In tracing systems these are typically events associated with a span (often called Span Events).

Use for notable moments, not every step.
- retries, cache misses, fallbacks
- external calls start/finish
- validation failures
- business milestones (payment authorized, order created)

Convention
- event name: lowercase + dot-separated
- add structured fields (attributes)

#### 4) Attributes (fields / tags)
Goal: structured, queryable metadata.

Naming
- lowercase
- dot-separated namespace: http.method, db.system, user.type

Avoid high-cardinality / PII (unless you have a strict policy)
- ❌ user.email, session.id, raw GUIDs, payload bodies
- ✅ user.type="premium", request.size=842, auth.result="failed"

#### Common attribute keys (practical)
HTTP
- http.method = GET
- http.route = /users/{id}
- http.status_code = 200
- http.client_ip = 203.0.113.5 (be careful w/ privacy)

Errors
- error.type = TimeoutError
- error.message = connection refused
- error.stacktrace = ... (optional; can be large)

DB
- db.system = postgresql
- db.operation = SELECT
- db.sql.table = users

Messaging
- messaging.system = kafka
- messaging.destination = order.created
- messaging.operation = SEND / RECEIVE

Cache
- cache.system = redis
- cache.hit = true/false
- cache.key_type = session (not the raw key!)

#### Examples
#### A) Service lifecycle
```rust
info!(service.name="checkout-api", service.version="1.7.3", deployment.environment="production", "service started");
info!(service.name="checkout-api", "readiness ok");
info!(service.name="checkout-api", "shutdown initiated");
```
#### B) Incoming HTTP request (route-based, not ID-based)
```rust
info!(event.name="http.request.received", http.method="GET", http.route="/users/{id}", "request received");
info!(event.name="http.request.completed", http.method="GET", http.route="/users/{id}", http.status_code=200, "request completed");
info!(event.name="http.request.completed", http.method="GET", http.route="/users/{id}", http.status_code=404, "not found");
```
#### C) Latency / timing (use numbers, not strings)
```rust
info!(event.name="http.latency", http.method="POST", http.route="/checkout", duration_ms=83u64, "request latency");
info!(event.name="db.latency", db.system="postgresql", db.operation="SELECT", db.sql.table="users", duration_ms=31u64, "db query latency");
```
#### D) Cache outcomes
```rust
info!(event.name="cache.lookup", cache.system="redis", cache.key_type="session", "cache lookup");
info!(event.name="cache.hit", cache.system="redis", cache.key_type="session", cache.hit=true, "cache hit");
info!(event.name="cache.miss", cache.system="redis", cache.key_type="session", cache.hit=false, "cache miss");
info!(event.name="cache.set", cache.system="redis", cache.key_type="session", ttl_s=900u64, "cache set");
```
#### E) Database operations
```rust
info!(event.name="db.query", db.system="postgresql", db.operation="SELECT", db.sql.table="users", "db query");
info!(event.name="db.query", db.system="postgresql", db.operation="INSERT", db.sql.table="orders", "db query");
info!(event.name="db.transaction.begin", db.system="postgresql", "tx begin");
info!(event.name="db.transaction.commit", db.system="postgresql", "tx commit");
```
#### F) External HTTP calls (downstream services)
```rust
info!(event.name="http.client.request", peer.service="payments-api", http.method="POST", http.route="/authorize", "downstream request");
info!(event.name="http.client.response", peer.service="payments-api", http.status_code=200, "downstream response");
info!(event.name="http.client.timeout", peer.service="payments-api", error.type="TimeoutError", "downstream timeout");
```
#### G) Retries & backoff
```rust
info!(event.name="retry.scheduled", retry.attempt=1u32, retry.backoff_ms=100u64, reason="timeout", "retry scheduled");
info!(event.name="retry.scheduled", retry.attempt=2u32, retry.backoff_ms=250u64, reason="5xx", "retry scheduled");
info!(event.name="retry.exhausted", retry.attempts=3u32, "retries exhausted");
```
#### H) Validation & user-visible errors (no PII)
```rust
info!(event.name="validation.failed", field="email", reason="invalid_format", "validation failed");
info!(event.name="auth.failed", auth.method="password", reason="invalid_credentials", "authentication failed");
info!(event.name="rate_limit.exceeded", limiter="login", "rate limit exceeded");
```
#### I) Business events (domain-level)
```rust
info!(event.name="checkout.started", user.type="registered", cart.items_count=3u32, "checkout started");
info!(event.name="payment.authorized", payment.provider="stripe", payment.method="card", "payment authorized");
info!(event.name="order.created", order.items_count=3u32, order.currency="USD", "order created");
info!(event.name="refund.issued", refund.reason="duplicate_charge", "refund issued");
```
#### J) Messaging / queues (Kafka/Rabbit/etc.)
```rust
info!(event.name="messaging.send", messaging.system="kafka", messaging.destination="order.created", "message sent");
info!(event.name="messaging.receive", messaging.system="kafka", messaging.destination="payment.confirmed", "message received");
info!(event.name="messaging.ack", messaging.system="kafka", messaging.destination="payment.confirmed", "message ack");
info!(event.name="messaging.nack", messaging.system="kafka", messaging.destination="payment.confirmed", reason="validation_failed", "message nack");
```
#### K) Background jobs / workers
```rust
info!(event.name="job.started", job.name="reconcile-payments", "job started");
info!(event.name="job.completed", job.name="reconcile-payments", duration_ms=1200u64, "job completed");
info!(event.name="job.failed", job.name="reconcile-payments", error.type="DbError", "job failed");
```
#### L) Feature flags / experiments
```rust
info!(event.name="feature.evaluated", feature.name="new-checkout", feature.enabled=true, "feature evaluated");
info!(event.name="experiment.assigned", experiment.name="pricing_v2", variant="B", "experiment assigned");
```
#### M) Security-relevant audit-ish events (be careful with data)
```rust
info!(event.name="security.token.refreshed", auth.method="oauth", "token refreshed");
info!(event.name="security.permission.denied", permission="orders:write", user.type="registered", "permission denied");
```

#### Cardinality & PII rules (quick checklist)

✅ Prefer
- routes over raw paths: /users/{id} not /users/123
- categories over identifiers: user.type="premium" not user.email
- sizes/counts over payloads: request.size, items_count

❌ Avoid
- raw IDs in span names or attributes unless explicitly approved
- request/response bodies
- session tokens, emails, phone numbers

#### Recommended minimal “always include” set
For request spans / logs:

- service.name
- deployment.environment
- http.method
- http.route
- http.status_code
- duration_ms (or similar)
- errors with error.type + error.message when applicable

#### Patterns you can standardize across a codebase
Event name prefixing
- http.*
- db.*
- cache.*
- messaging.*
- auth.*
- job.*
- security.*
- domain: checkout.*, payment.*, order.*

Field namespaces
- http.*, db.*, cache.*, messaging.*, retry.*, error.*, user.*, order.*, payment.*
