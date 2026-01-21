/**
 * Internal Utils - TypeScript Edition
 *
 * A collection of utilities for logging, tracing, database, and validation.
 * Mirrors the Rust internal-utils crate API where applicable.
 *
 * @packageDocumentation
 */

// Tracing exports
export {
  TracingBuilder,
  createLogger,
  createSimpleLogger,
  createChildLogger,
  getMeter,
  getTracer,
} from "./tracing/index.js";

export type {
  LogLevel,
  LogFormat,
  OtelParams,
  FileOutputConfig,
  TracingConfig,
  TracingGuards,
} from "./tracing/index.js";

// Database exports
export { Db, createPool, createPoolFromEnv } from "./db/index.js";

export type {
  DbConfig,
  DbClient,
  HealthCheckResult,
  TransactionOptions,
  Pool,
  PoolClient,
  PoolConfig,
  QueryResult,
} from "./db/index.js";

// Validation exports
export {
  z,
  schemas,
  createIdSchema,
  optionalField,
  nullableField,
  validate,
  safeValidate,
  formatValidationErrors,
  flattenValidationErrors,
  createValidator,
  mergeSchemas,
  createDiscriminatedUnion,
} from "./validation/index.js";

export type {
  Infer,
  Input,
  Output,
  ZodError,
  ZodIssue,
  ZodType,
  ZodSchema,
} from "./validation/index.js";

// Re-export external libraries for convenience
export { default as pino } from "pino";
export type { Logger } from "pino";
