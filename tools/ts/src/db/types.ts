import type { Pool, PoolConfig, PoolClient, QueryResult } from "pg";

/**
 * Database connection configuration.
 */
export interface DbConfig {
  /** PostgreSQL connection string (e.g., postgres://user:pass@host:5432/db) */
  connectionString?: string | undefined;
  /** Database host */
  host?: string | undefined;
  /** Database port (defaults to 5432) */
  port?: number | undefined;
  /** Database name */
  database?: string | undefined;
  /** Database user */
  user?: string | undefined;
  /** Database password */
  password?: string | undefined;
  /** Maximum number of connections in the pool (defaults to 10) */
  maxConnections?: number | undefined;
  /** Connection timeout in milliseconds (defaults to 30000) */
  connectionTimeoutMs?: number | undefined;
  /** Idle timeout in milliseconds (defaults to 10000) */
  idleTimeoutMs?: number | undefined;
  /** SSL configuration */
  ssl?: boolean | { rejectUnauthorized?: boolean } | undefined;
}

/**
 * Health check result for the database connection.
 */
export interface HealthCheckResult {
  /** Whether the database is healthy */
  healthy: boolean;
  /** Response time in milliseconds */
  latencyMs: number;
  /** Error message if unhealthy */
  error?: string | undefined;
  /** Pool statistics */
  pool: {
    /** Total connections in the pool */
    total: number;
    /** Idle connections */
    idle: number;
    /** Waiting clients */
    waiting: number;
  };
}

/**
 * Transaction options.
 */
export interface TransactionOptions {
  /** Isolation level for the transaction */
  isolationLevel?: "READ UNCOMMITTED" | "READ COMMITTED" | "REPEATABLE READ" | "SERIALIZABLE";
}

/**
 * Database client wrapper with additional utilities.
 */
export interface DbClient {
  /** The underlying pg Pool instance */
  pool: Pool;
  /** Execute a query */
  query: <T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[]
  ) => Promise<QueryResult<T>>;
  /** Execute a callback within a transaction */
  transaction: <T>(
    callback: (client: PoolClient) => Promise<T>,
    options?: TransactionOptions
  ) => Promise<T>;
  /** Check database health */
  healthCheck: () => Promise<HealthCheckResult>;
  /** Close all connections */
  close: () => Promise<void>;
}

/**
 * Re-export pg types for convenience.
 */
export type { Pool, PoolClient, PoolConfig, QueryResult };
