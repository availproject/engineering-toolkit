import pg from "pg";
import type {
  DbConfig,
  DbClient,
  HealthCheckResult,
  TransactionOptions,
} from "./types.js";

const { Pool } = pg;

/**
 * Creates a PostgreSQL connection pool with the provided configuration.
 *
 * @param config - Database configuration
 * @returns Promise resolving to a DbClient instance
 */
export async function createPool(config: DbConfig): Promise<DbClient> {
  const poolConfig: pg.PoolConfig = {};

  // Use connection string if provided, otherwise use individual params
  if (config.connectionString) {
    poolConfig.connectionString = config.connectionString;
  } else {
    poolConfig.host = config.host ?? "localhost";
    poolConfig.port = config.port ?? 5432;
    poolConfig.database = config.database;
    poolConfig.user = config.user;
    poolConfig.password = config.password;
  }

  // Pool configuration
  poolConfig.max = config.maxConnections ?? 10;
  poolConfig.connectionTimeoutMillis = config.connectionTimeoutMs ?? 30000;
  poolConfig.idleTimeoutMillis = config.idleTimeoutMs ?? 10000;

  // SSL configuration
  if (config.ssl !== undefined) {
    poolConfig.ssl = config.ssl;
  }

  const pool = new Pool(poolConfig);

  // Test the connection
  try {
    const client = await pool.connect();
    client.release();
  } catch (error) {
    await pool.end();
    throw new Error(
      `Failed to connect to database: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Create the client wrapper
  const dbClient: DbClient = {
    pool,

    async query<T extends Record<string, unknown> = Record<string, unknown>>(
      text: string,
      values?: unknown[]
    ) {
      return pool.query<T>(text, values);
    },

    async transaction<T>(
      callback: (client: pg.PoolClient) => Promise<T>,
      options?: TransactionOptions
    ): Promise<T> {
      const client = await pool.connect();

      try {
        // Set isolation level if specified
        if (options?.isolationLevel) {
          await client.query(
            `SET TRANSACTION ISOLATION LEVEL ${options.isolationLevel}`
          );
        }

        await client.query("BEGIN");
        const result = await callback(client);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async healthCheck(): Promise<HealthCheckResult> {
      const start = performance.now();

      try {
        await pool.query("SELECT 1");
        const latencyMs = performance.now() - start;

        return {
          healthy: true,
          latencyMs,
          pool: {
            total: pool.totalCount,
            idle: pool.idleCount,
            waiting: pool.waitingCount,
          },
        };
      } catch (error) {
        const latencyMs = performance.now() - start;

        return {
          healthy: false,
          latencyMs,
          error: error instanceof Error ? error.message : String(error),
          pool: {
            total: pool.totalCount,
            idle: pool.idleCount,
            waiting: pool.waitingCount,
          },
        };
      }
    },

    async close(): Promise<void> {
      await pool.end();
    },
  };

  return dbClient;
}

/**
 * Creates a PostgreSQL connection pool from the DATABASE_URL environment variable.
 *
 * @param maxConnections - Maximum number of connections (defaults to 10)
 * @returns Promise resolving to a DbClient instance
 * @throws Error if DATABASE_URL is not set
 */
export async function createPoolFromEnv(
  maxConnections?: number
): Promise<DbClient> {
  const connectionString = process.env["DATABASE_URL"];

  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  return createPool({
    connectionString,
    maxConnections,
  });
}
