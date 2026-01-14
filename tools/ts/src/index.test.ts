import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import {
  TracingBuilder,
  z,
  schemas,
  validate,
  safeValidate,
  formatValidationErrors,
  flattenValidationErrors,
  createIdSchema,
} from "./index.js";

describe("TracingBuilder", () => {
  it("should create a logger with default settings", async () => {
    const { logger, shutdown } = await TracingBuilder.create()
      .withLogLevel("info")
      .withJson(true)
      .withStdout(false) // Suppress output during tests
      .init();

    assert.ok(logger, "Logger should be created");
    assert.ok(typeof logger.info === "function", "Logger should have info method");
    assert.ok(typeof logger.error === "function", "Logger should have error method");
    assert.ok(typeof shutdown === "function", "Shutdown should be a function");

    await shutdown();
  });

  it("should create a logger with pretty format", async () => {
    const { logger, shutdown } = await TracingBuilder.create()
      .withFormat("pretty")
      .withStdout(false)
      .init();

    assert.ok(logger, "Logger should be created");

    await shutdown();
  });

  it("should support child loggers", async () => {
    const { logger, shutdown } = await TracingBuilder.create()
      .withStdout(false)
      .init();

    const child = logger.child({ requestId: "test-123" });
    assert.ok(child, "Child logger should be created");

    await shutdown();
  });
});

describe("Validation - schemas", () => {
  it("should validate UUID", () => {
    const schema = schemas.uuid();
    const validUuid = "550e8400-e29b-41d4-a716-446655440000";
    const invalidUuid = "not-a-uuid";

    assert.strictEqual(schema.parse(validUuid), validUuid);
    assert.throws(() => schema.parse(invalidUuid));
  });

  it("should validate email", () => {
    const schema = schemas.email();

    assert.strictEqual(schema.parse("user@example.com"), "user@example.com");
    assert.throws(() => schema.parse("invalid-email"));
  });

  it("should validate URL", () => {
    const schema = schemas.url();

    assert.strictEqual(
      schema.parse("https://example.com"),
      "https://example.com"
    );
    assert.throws(() => schema.parse("not-a-url"));
  });

  it("should validate datetime", () => {
    const schema = schemas.datetime();
    const validDatetime = "2024-01-15T10:30:00Z";

    assert.strictEqual(schema.parse(validDatetime), validDatetime);
    assert.throws(() => schema.parse("2024-01-15")); // Date only
  });

  it("should validate pagination", () => {
    const schema = schemas.pagination({ defaultLimit: 20, maxLimit: 100 });

    // With defaults
    const withDefaults = schema.parse({});
    assert.strictEqual(withDefaults.limit, 20);
    assert.strictEqual(withDefaults.offset, 0);

    // With custom values
    const custom = schema.parse({ limit: 50, offset: 10 });
    assert.strictEqual(custom.limit, 50);
    assert.strictEqual(custom.offset, 10);

    // Exceeds max
    assert.throws(() => schema.parse({ limit: 200 }));
  });

  it("should validate slug", () => {
    const schema = schemas.slug();

    assert.strictEqual(schema.parse("my-page-slug"), "my-page-slug");
    assert.strictEqual(schema.parse("page123"), "page123");
    assert.throws(() => schema.parse("Invalid Slug"));
    assert.throws(() => schema.parse("UPPERCASE"));
  });

  it("should validate semver", () => {
    const schema = schemas.semver();

    assert.strictEqual(schema.parse("1.2.3"), "1.2.3");
    assert.strictEqual(schema.parse("0.1.0-beta.1"), "0.1.0-beta.1");
    assert.throws(() => schema.parse("1.2"));
    assert.throws(() => schema.parse("v1.2.3"));
  });

  it("should validate positive integer", () => {
    const schema = schemas.positiveInt();

    assert.strictEqual(schema.parse(1), 1);
    assert.strictEqual(schema.parse(100), 100);
    assert.throws(() => schema.parse(0));
    assert.throws(() => schema.parse(-1));
    assert.throws(() => schema.parse(1.5));
  });

  it("should coerce number from string", () => {
    const schema = schemas.coercedNumber();

    assert.strictEqual(schema.parse("42"), 42);
    assert.strictEqual(schema.parse(42), 42);
  });

  it("should validate HTTP response status", () => {
    const schema = schemas.httpResponseStatus();

    const valid = schema.parse({ status: "404" });
    assert.strictEqual(valid.status, "404");

    const withMessage = schema.parse({ status: "500", message: "Server error" });
    assert.strictEqual(withMessage.message, "Server error");
  });
});

describe("Validation - helpers", () => {
  it("should validate with validate()", () => {
    const schema = z.object({ name: z.string() });
    const result = validate(schema, { name: "Alice" });
    assert.strictEqual(result.name, "Alice");
  });

  it("should return success with safeValidate()", () => {
    const schema = z.object({ name: z.string() });
    const result = safeValidate(schema, { name: "Alice" });

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.name, "Alice");
    }
  });

  it("should return error with safeValidate()", () => {
    const schema = z.object({ name: z.string() });
    const result = safeValidate(schema, { name: 123 });

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.ok(result.error.issues.length > 0);
    }
  });

  it("should format validation errors", () => {
    const schema = z.object({
      email: z.string().email(),
      age: z.number().positive(),
    });

    const result = safeValidate(schema, { email: "invalid", age: -1 });
    assert.strictEqual(result.success, false);

    if (!result.success) {
      const formatted = formatValidationErrors(result.error);
      assert.ok("email" in formatted);
      assert.ok("age" in formatted);
    }
  });

  it("should flatten validation errors", () => {
    const schema = z.object({ name: z.string().min(1) });
    const result = safeValidate(schema, { name: "" });

    assert.strictEqual(result.success, false);

    if (!result.success) {
      const flattened = flattenValidationErrors(result.error);
      assert.ok(Array.isArray(flattened));
      assert.ok(flattened.length > 0);
      assert.ok(flattened[0]?.includes("name"));
    }
  });

  it("should create branded ID schemas", () => {
    const UserId = createIdSchema("User");
    const validId = "550e8400-e29b-41d4-a716-446655440000";

    const result = UserId.parse(validId);
    assert.strictEqual(result, validId);

    assert.throws(() => UserId.parse("not-a-uuid"));
  });
});

describe("Validation - complex schemas", () => {
  it("should validate nested objects", () => {
    const AddressSchema = z.object({
      street: z.string(),
      city: z.string(),
      zip: z.string(),
    });

    const UserSchema = z.object({
      id: schemas.uuid(),
      email: schemas.email(),
      address: AddressSchema,
    });

    const valid = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      email: "user@example.com",
      address: {
        street: "123 Main St",
        city: "Springfield",
        zip: "12345",
      },
    };

    const result = validate(UserSchema, valid);
    assert.strictEqual(result.email, "user@example.com");
    assert.strictEqual(result.address.city, "Springfield");
  });

  it("should validate arrays", () => {
    const TagsSchema = z.array(schemas.slug()).min(1).max(5);

    const valid = ["tag-one", "tag-two"];
    const result = validate(TagsSchema, valid);
    assert.strictEqual(result.length, 2);

    assert.throws(() => validate(TagsSchema, [])); // min 1
    assert.throws(() => validate(TagsSchema, ["a", "b", "c", "d", "e", "f"])); // max 5
  });

  it("should validate discriminated unions", () => {
    const EventSchema = z.discriminatedUnion("type", [
      z.object({ type: z.literal("click"), x: z.number(), y: z.number() }),
      z.object({ type: z.literal("scroll"), offset: z.number() }),
    ]);

    const clickEvent = validate(EventSchema, { type: "click", x: 10, y: 20 });
    assert.strictEqual(clickEvent.type, "click");

    const scrollEvent = validate(EventSchema, { type: "scroll", offset: 100 });
    assert.strictEqual(scrollEvent.type, "scroll");
  });
});
