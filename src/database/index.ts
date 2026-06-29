import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { logger } from '../utils/logger';

// Database connection configuration
const connectionString = process.env.DATABASE_URL || 'postgresql://localhost/pegasus';

// Maximum number of connections in the pool
const maxConnections = parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10);

// Create postgres connection with connection pooling
const queryClient = postgres(connectionString, {
  max: maxConnections,
  idle_timeout: 0, // Disable client-side idle timeout to prevent TimeoutNegativeWarning in Node 24+
  connect_timeout: 30, // Increased timeout for better resilience with Neon serverless pooler
  fetch_types: false, // Prevents custom type fetching on connection initialization, saving extra round-trips to Neon pooler
  // Connection pool settings optimized for Discord bot workloads
  prepare: true, // Prepared statements for better performance
  ssl: connectionString.includes('sslmode=require') || connectionString.includes('.neon.tech') ? 'require' : (process.env.DB_SSL === 'false' ? false : 'require'),

  // Error handling
  onnotice: notice => {
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Database notice:', notice);
    }
  },

  // Transform options for BigInt handling
  transform: {
    undefined: null, // Convert undefined to null
  },

  // Types configuration for proper BigInt handling
  types: {
    bigint: postgres.BigInt,
  },
});

// Create drizzle instance with schema
export const db = drizzle(queryClient, {
  schema,
  logger: process.env.NODE_ENV === 'development',
});

// Export schema for use in other files
export * from './schema';

// Database health check
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await queryClient`SELECT 1`;
    logger.info('Database connection established successfully');
    return true;
  } catch (error) {
    logger.error('Failed to connect to database:', error);
    return false;
  }
}

// Graceful shutdown
export async function closeDatabaseConnection(): Promise<void> {
  try {
    await queryClient.end();
    logger.info('Database connection closed');
  } catch (error) {
    logger.error('Error closing database connection:', error);
  }
}

// Transaction helper with retry logic
export async function withTransaction<T>(
  callback: (tx: typeof db) => Promise<T>,
  retries = 3
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < retries; i++) {
    try {
      return await db.transaction(async tx => {
        return await callback(tx as typeof db);
      });
    } catch (error) {
      lastError = error as Error;

      // Don't retry on constraint violations or other non-retryable errors
      if (
        error instanceof Error &&
        (error.message.includes('constraint') ||
          error.message.includes('duplicate') ||
          error.message.includes('violates'))
      ) {
        throw error;
      }

      // Wait before retry with exponential backoff
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 100));
      }
    }
  }

  throw lastError || new Error('Transaction failed after retries');
}

// Query performance monitoring
export function createQueryTimer(queryName: string) {
  const startTime = process.hrtime.bigint();

  return {
    end: () => {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds

      if (duration > 1000) {
        logger.warn(`Slow query detected: ${queryName} took ${duration.toFixed(2)}ms`);
      } else if (process.env.NODE_ENV === 'development') {
        logger.debug(`Query ${queryName} took ${duration.toFixed(2)}ms`);
      }
    },
  };
}

// Helper to safely handle Discord IDs (BigInt conversion)
export function toDiscordId(value: string | number | bigint): string {
  return value.toString();
}

export function fromDiscordId(value: string): bigint {
  return BigInt(value);
}

// Batch insert helper for better performance
export async function batchInsert<T extends Record<string, unknown>>(
  table: ReturnType<typeof import('drizzle-orm/pg-core').pgTable>,
  data: T[],
  batchSize = 1000
): Promise<void> {
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    await db.insert(table).values(batch);
  }
}
