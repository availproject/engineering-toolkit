### Logging and Tracing Events
What was previously referred to as logging is now described as emitting tracing events.
An event represents a specific occurrence at a single point in time and always includes structured contextual information.

For laics, "structured contextual information" means that instead of writing
```rust
tracing::info!(std::format("My service: {}, reason: {}, ..., HTTP Fetch Failed"), service_name, reason);
```
we write 
```rust
tracing::event!(target: "my-service", tracing::Level::INFO, reason, code_debug = ?code, code_display = %code, "HTTP Fetch Failed");
// or
tracing::info!(target: "my-service", reason, code_debug = ?code, code_display = %code, "HTTP Fetch Failed");
```
and in return get back the following log:
```
2026-01-13T13:19:28.916474Z  INFO my-service: HTTP Fetch Failed reason="No Reason" code_debug="200" code_display=200
```
or (if json is enabled)
```json
{"timestamp":"2026-01-13T13:25:00.218663Z","level":"INFO","fields":{"message":"HTTP Fetch Failed","reason":"No Reason","code_debug":"\"200\"","code_display":"200"},"target":"my-service"}
```

- `%value`: Uses std::fmt::Display (e.g., info!(username = %user_name)). This is ideal for user-friendly, clean output.
- `?value`: Uses std::fmt::Debug (e.g., info!(user = ?user_struct)). This is used for structured, technical, or nested data. 

Events may be either standalone (not associated with any span) or span-associated (emitted within a span).
When OpenTelemetry (Otel) is enabled, standalone events are exported(send to otel) as logs, while span-associated events become part of traces. Events (both standalone and span-associated) are printed out as logs to stdout and files.

### Standardized Event Structure
#### HTTP Non-200 Response Status
Must include the following context:
- `status`: 
    - Required: true
    - Type: String
    - Description: Status Code (400, 500, 600)
    - Example "404"
- `message`:
    - Required: false
    - Type: String
    - Description: Optional message returned by the API.
    - Example: "Item not found. Don't ask why"


### Tracing Levels Explained
`trace!`
- Very detailed internal flow
- Function entry/exit, loops, raw data
- Only for deep debugging
- Usually disabled in production

`debug!`
- Developer diagnostics
- State, inputs/outputs, decisions, config
- Useful in dev/staging

`info!`
- Normal application events
- Startup/shutdown, successful actions
- Safe for production logs

`warn!`
- Unexpected but recoverable issues
- Fallbacks, retries, deprecated usage
- Needs attention but system continues

`error!`
- Failures that affect functionality
- Requests failed, data loss risk, broken operations
- Must be investigated

Rule of Thumb

| Level |	Meaning |
| - | - |
|trace| 	Only for deep debugging |
|debug| 	Helpful for developers |
|info	| Useful for normal operations |
|warn	| Something went wrong, but recovered |
|error| 	Something failed and needs fixing |
