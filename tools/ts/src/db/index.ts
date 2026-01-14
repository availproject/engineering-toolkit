import { createPool, createPoolFromEnv } from "./postgres.js";
import type {
  DbConfig,
  DbClient,
  HealthCheckResult,
  TransactionOptions,
  Pool,
  PoolClient,
  PoolConfig,
  QueryResult,
} from "./types.js";

// Re-export types
export type {
  DbConfig,
  DbClient,
  HealthCheckResult,
  TransactionOptions,
  Pool,
  PoolClient,
  PoolConfig,
  QueryResult,
};

// Re-export functions
export { createPool, createPoolFromEnv };

/**
 * Database utility class providing a static interface matching the Rust API.
 *
 * @example
 * ```typescript
 * // Initialize from config
 * const db = await Db.initialize({
 *   connectionString: 'postgres://user:pass@localhost:5432/mydb',
 *   maxConnections: 10,
 * });
 *
 * // Or from environment
 * const db = await Db.initializeFromEnv();
 *
 * // Execute queries
 * const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
 *
 * // Use transactions
 * await db.transaction(async (client) => {
 *   await client.query('INSERT INTO users (name) VALUES ($1)', ['Alice']);
 *   await client.query('INSERT INTO logs (action) VALUES ($1)', ['user_created']);
 * });
 *
 * // Health check
 * const health = await db.healthCheck();
 * console.log(health.healthy, health.latencyMs);
 *
 * // Cleanup
 * await db.close();
 * ```
 */
export class Db {
  /**
   * Initialize a database connection pool with the provided configuration.
   *
   * @param config - Database configuration
   * @returns Promise resolving to a DbClient instance
   */
  static async initialize(config: DbConfig): Promise<DbClient> {
    return createPool(config);
  }

  /**
   * Initialize a database connection pool from environment variables.
   * Uses DATABASE_URL environment variable.
   *
   * @param maxConnections - Maximum number of connections (defaults to 10)
   * @returns Promise resolving to a DbClient instance
   */
  static async initializeFromEnv(maxConnections?: number): Promise<DbClient> {
    return createPoolFromEnv(maxConnections);
  }

  /**
   * Shorthand for initialize() to match Rust API.
   *
   * @param url - PostgreSQL connection URL
   * @param maxConnections - Maximum number of connections (defaults to 5)
   * @returns Promise resolving to a DbClient instance
   */
  static async connect(
    url: string,
    maxConnections: number = 5
  ): Promise<DbClient> {
    return createPool({
      connectionString: url,
      maxConnections,
    });
  }
}
