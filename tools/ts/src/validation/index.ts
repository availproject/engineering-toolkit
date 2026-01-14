import { z } from "zod";
import { schemas, createIdSchema, optionalField, nullableField } from "./schemas.js";

// Re-export zod for convenience
export { z } from "zod";

// Re-export schema helpers
export { schemas, createIdSchema, optionalField, nullableField };

// Re-export commonly used Zod types
export type { ZodError, ZodIssue, ZodType, ZodSchema } from "zod";

/**
 * Type inference helper for Zod schemas.
 * @example type User = Infer<typeof UserSchema>;
 */
export type Infer<T extends z.ZodType> = z.infer<T>;

/**
 * Input type inference helper for Zod schemas.
 * @example type UserInput = Input<typeof UserSchema>;
 */
export type Input<T extends z.ZodType> = z.input<T>;

/**
 * Output type inference helper for Zod schemas.
 * @example type UserOutput = Output<typeof UserSchema>;
 */
export type Output<T extends z.ZodType> = z.output<T>;

/**
 * Validates data against a schema and returns the result.
 * Throws ZodError if validation fails.
 *
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Validated and transformed data
 * @throws ZodError if validation fails
 */
export function validate<T extends z.ZodType>(
  schema: T,
  data: unknown
): z.infer<T> {
  return schema.parse(data);
}

/**
 * Safely validates data against a schema.
 * Returns a result object instead of throwing.
 *
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns SafeParseResult with success boolean and data/error
 */
export function safeValidate<T extends z.ZodType>(
  schema: T,
  data: unknown
): z.SafeParseReturnType<z.input<T>, z.output<T>> {
  return schema.safeParse(data);
}

/**
 * Formats Zod errors into a human-readable object.
 * Useful for API error responses.
 *
 * @param error - ZodError to format
 * @returns Object mapping field paths to error messages
 */
export function formatValidationErrors(
  error: z.ZodError
): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.length > 0 ? issue.path.join(".") : "_root";
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path].push(issue.message);
  }

  return formatted;
}

/**
 * Formats Zod errors into a flat array of error messages.
 *
 * @param error - ZodError to format
 * @returns Array of error messages with field paths
 */
export function flattenValidationErrors(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return `${path}${issue.message}`;
  });
}

/**
 * Creates an async validation function for a schema.
 * Useful for Express/Fastify middleware.
 *
 * @param schema - Zod schema to validate against
 * @returns Async validation function
 */
export function createValidator<T extends z.ZodType>(schema: T) {
  return async (data: unknown): Promise<z.infer<T>> => {
    return schema.parseAsync(data);
  };
}

/**
 * Merges two Zod object schemas into one.
 * Useful for composing schemas from mixins.
 *
 * @param schema1 - First Zod object schema
 * @param schema2 - Second Zod object schema to merge
 * @returns Merged schema
 */
export function mergeSchemas<
  T extends z.AnyZodObject,
  U extends z.AnyZodObject,
>(schema1: T, schema2: U) {
  return schema1.merge(schema2);
}

/**
 * Creates a discriminated union schema helper.
 * Useful for polymorphic types.
 *
 * @param discriminator - The discriminator field name
 * @param options - Array of schemas with the discriminator field (must have at least 2)
 * @returns Discriminated union schema
 */
export function createDiscriminatedUnion<
  K extends string,
  T extends [z.ZodDiscriminatedUnionOption<K>, ...z.ZodDiscriminatedUnionOption<K>[]],
>(discriminator: K, options: T) {
  return z.discriminatedUnion(discriminator, options);
}
