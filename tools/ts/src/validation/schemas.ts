import { z } from "zod";

/**
 * Common schema helpers for frequently used patterns.
 * These provide pre-built Zod schemas with sensible defaults.
 */
export const schemas = {
  /**
   * UUID v4 string schema.
   * @example schemas.uuid() // Validates '550e8400-e29b-41d4-a716-446655440000'
   */
  uuid: () =>
    z.string().uuid({ message: "Invalid UUID format" }),

  /**
   * Email string schema.
   * @example schemas.email() // Validates 'user@example.com'
   */
  email: () =>
    z.string().email({ message: "Invalid email format" }),

  /**
   * URL string schema.
   * @example schemas.url() // Validates 'https://example.com'
   */
  url: () =>
    z.string().url({ message: "Invalid URL format" }),

  /**
   * Non-empty string schema.
   * @param maxLength - Optional maximum length
   * @example schemas.nonEmptyString(100) // Non-empty string up to 100 chars
   */
  nonEmptyString: (maxLength?: number) => {
    const base = z.string().min(1, { message: "String cannot be empty" });
    return maxLength !== undefined ? base.max(maxLength) : base;
  },

  /**
   * ISO 8601 datetime string schema.
   * @example schemas.datetime() // Validates '2024-01-15T10:30:00Z'
   */
  datetime: () =>
    z.string().datetime({ message: "Invalid ISO 8601 datetime format" }),

  /**
   * Date string schema (YYYY-MM-DD).
   * @example schemas.date() // Validates '2024-01-15'
   */
  date: () =>
    z.string().date("Invalid date format (expected YYYY-MM-DD)"),

  /**
   * Positive integer schema.
   * @example schemas.positiveInt() // Validates 1, 42, 100
   */
  positiveInt: () =>
    z.number().int().positive({ message: "Must be a positive integer" }),

  /**
   * Non-negative integer schema.
   * @example schemas.nonNegativeInt() // Validates 0, 1, 42
   */
  nonNegativeInt: () =>
    z.number().int().nonnegative({ message: "Must be a non-negative integer" }),

  /**
   * Pagination parameters schema.
   * @param defaults - Default values for limit and offset
   * @example schemas.pagination({ defaultLimit: 20, maxLimit: 100 })
   */
  pagination: (options?: {
    defaultLimit?: number;
    maxLimit?: number;
    defaultOffset?: number;
  }) => {
    const defaultLimit = options?.defaultLimit ?? 10;
    const maxLimit = options?.maxLimit ?? 100;
    const defaultOffset = options?.defaultOffset ?? 0;

    return z.object({
      limit: z
        .number()
        .int()
        .min(1)
        .max(maxLimit)
        .default(defaultLimit),
      offset: z
        .number()
        .int()
        .nonnegative()
        .default(defaultOffset),
    });
  },

  /**
   * HTTP response status schema matching the tracing-explained.md structure.
   * @example schemas.httpResponseStatus()
   */
  httpResponseStatus: () =>
    z.object({
      status: z.string().describe("HTTP status code as string (e.g., '404')"),
      message: z.string().optional().describe("Optional message from the API"),
    }),

  /**
   * Sort order schema for API queries.
   * @example schemas.sortOrder() // 'asc' | 'desc'
   */
  sortOrder: () =>
    z.enum(["asc", "desc"]).default("asc"),

  /**
   * Environment name schema.
   * @example schemas.environment()
   */
  environment: () =>
    z.enum(["development", "staging", "production", "test"]),

  /**
   * Slug schema (URL-friendly identifier).
   * @example schemas.slug() // Validates 'my-page-slug'
   */
  slug: () =>
    z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
        message: "Invalid slug format (lowercase letters, numbers, and hyphens only)",
      }),

  /**
   * Semantic version schema.
   * @example schemas.semver() // Validates '1.2.3', '0.1.0-beta.1'
   */
  semver: () =>
    z
      .string()
      .regex(
        /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/,
        { message: "Invalid semantic version format" }
      ),

  /**
   * IP address schema (v4 or v6).
   * @example schemas.ip() // Validates '192.168.1.1' or '::1'
   */
  ip: () =>
    z.string().ip({ message: "Invalid IP address" }),

  /**
   * IPv4 address schema.
   * @example schemas.ipv4() // Validates '192.168.1.1'
   */
  ipv4: () =>
    z.string().ip({ version: "v4", message: "Invalid IPv4 address" }),

  /**
   * IPv6 address schema.
   * @example schemas.ipv6() // Validates '::1'
   */
  ipv6: () =>
    z.string().ip({ version: "v6", message: "Invalid IPv6 address" }),

  /**
   * JSON string schema that parses and validates the JSON content.
   * @param innerSchema - Schema to validate the parsed JSON against
   * @example schemas.jsonString(z.object({ name: z.string() }))
   */
  jsonString: <T extends z.ZodTypeAny>(innerSchema: T) =>
    z.string().transform((str, ctx) => {
      try {
        const parsed = JSON.parse(str);
        const result = innerSchema.safeParse(parsed);
        if (!result.success) {
          result.error.issues.forEach((issue) => ctx.addIssue(issue));
          return z.NEVER;
        }
        return result.data as z.infer<T>;
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid JSON string",
        });
        return z.NEVER;
      }
    }),

  /**
   * Coerced number schema that converts string inputs to numbers.
   * Useful for query parameters.
   * @example schemas.coercedNumber() // Converts '42' to 42
   */
  coercedNumber: () => z.coerce.number(),

  /**
   * Coerced boolean schema that converts string inputs.
   * Useful for query parameters.
   * @example schemas.coercedBoolean() // Converts 'true' to true
   */
  coercedBoolean: () => z.coerce.boolean(),
};

/**
 * Helper to create an ID schema for a specific entity.
 * Uses branded types for type safety.
 *
 * @param entityName - Name of the entity for error messages
 * @example
 * const UserId = createIdSchema('User');
 * type UserId = z.infer<typeof UserId>;
 */
export function createIdSchema(entityName: string) {
  return z
    .string()
    .uuid({ message: `Invalid ${entityName} ID format` })
    .brand<`${typeof entityName}Id`>();
}

/**
 * Helper to create optional fields that default to undefined.
 * Useful for distinguishing between "not provided" and "set to null".
 *
 * @param schema - The schema to make optional
 */
export function optionalField<T extends z.ZodTypeAny>(schema: T) {
  return schema.optional();
}

/**
 * Helper to create nullable fields.
 *
 * @param schema - The schema to make nullable
 */
export function nullableField<T extends z.ZodTypeAny>(schema: T) {
  return schema.nullable();
}
