// ========================
// External Imports
// ========================
import fs from 'node:fs';
import path from 'node:path';
import pkg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'discord.js';

// ========================
// Internal Imports
// ========================
import * as schema from './schema.js';
import { loadConfig } from '@/util/configLoader.js';
import { del, exists, getJson, setJson } from './redis.js';
import {
  logManagerNotification,
  NotificationType,
  notifyManagers,
} from '@/util/notificationHandler.js';
import { logger } from '@/util/logger.js';

// ========================
// Database Configuration
// ========================
const { Pool } = pkg;
const config = loadConfig();

// Connection parameters
const MAX_DB_RETRY_ATTEMPTS = config.database.maxRetryAttempts;
const INITIAL_DB_RETRY_DELAY = config.database.retryDelay;

// Query retry parameters
const QUERY_MAX_RETRY_ATTEMPTS = Math.max(
  1,
  Number(config.database.queryRetryAttempts ?? 3),
);
const QUERY_INITIAL_RETRY_DELAY = Math.max(
  1,
  Number(config.database.queryRetryInitialDelay ?? 200),
);

// ========================
// Connection State Variables
// ========================
let isDbConnected = false;
let connectionAttempts = 0;
let hasNotifiedDbDisconnect = false;
let discordClient: Client | null = null;
let dbPool: pkg.Pool | undefined;
export let db: ReturnType<typeof drizzle>;

/**
 * Custom error class for database operations
 */
class DatabaseError extends Error {
  constructor(
    message: string,
    public originalError?: Error,
  ) {
    super(message);
    this.name = 'DatabaseError';
    if (originalError) {
      this.stack = originalError.stack;
    }
  }
}

// ========================
// Client Management
// ========================

/**
 * Sets the Discord client for sending notifications
 * @param client - The Discord client
 */
export function setDiscordClient(client: Client): void {
  discordClient = client;
}

// ========================
// Connection Management
// ========================

/**
 * Sleep for a given number of milliseconds.
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after the specified delay
 */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Checks if an error is a transient connection error that might be worth retrying
 * @param error - The error to check
 * @returns True if the error appears to be a transient connection issue
 */
function isTransientConnectionError(error: any): boolean {
  if (!error) return false;

  const message = error.message?.toLowerCase() || '';
  const code = error.code;

  // PostgreSQL connection errors
  const transientCodes = [
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'EAI_AGAIN',
    // connection_exception
    '08000',
    // connection_does_not_exist
    '08003',
    // connection_failure
    '08006',
    // sqlclient_unable_to_establish_sqlconnection
    '08001',
    // sqlserver_rejected_establishment_of_sqlconnection
    '08004',
    // admin_shutdown
    '57P01',
    // crash_shutdown
    '57P02',
    // cannot_connect_now
    '57P03',
  ];

  return (
    transientCodes.includes(code) ||
    message.includes('connection') ||
    message.includes('timeout') ||
    message.includes('network') ||
    message.includes('reset') ||
    message.includes('refused')
  );
}

/**
 * Checks if a SQL query is safe to retry (idempotent)
 * @param sql - The SQL query string
 * @returns True if the query is safe to retry
 */
function isIdempotentQuery(sql: string): boolean {
  const normalizedSql = sql.trim().toUpperCase();

  // Allow SELECT queries
  if (normalizedSql.startsWith('SELECT')) return true;

  // Allow SHOW/DESCRIBE/EXPLAIN queries
  if (
    normalizedSql.startsWith('SHOW') ||
    normalizedSql.startsWith('DESCRIBE') ||
    normalizedSql.startsWith('EXPLAIN')
  ) {
    return true;
  }

  // Disallow all other operations by default
  return false;
}

/**
 * Execute a database query with retry logic for idempotent operations
 * @param pool - The database pool
 * @param sql - SQL query string
 * @param params - Query parameters
 * @param options - Retry options
 * @returns Query result
 */
export async function withDbRetryQuery<
  T extends pkg.QueryResultRow = pkg.QueryResultRow,
>(
  pool: pkg.Pool,
  sql: string,
  params?: any[],
  options: {
    maxAttempts?: number;
    initialDelay?: number;
    forceRetry?: boolean;
    operationName?: string;
  } = {},
): Promise<pkg.QueryResult<T>> {
  const {
    maxAttempts = QUERY_MAX_RETRY_ATTEMPTS,
    initialDelay = QUERY_INITIAL_RETRY_DELAY,
    forceRetry = false,
    operationName = 'db-query',
  } = options;

  // Safety check: only retry if query is idempotent or caller explicitly forces
  if (!forceRetry && !isIdempotentQuery(sql)) {
    logger.warn(
      `[DatabaseManager] Non-idempotent query detected, executing without retry: ${sql.substring(
        0,
        50,
      )}...`,
    );
    return pool.query(sql, params);
  }

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await pool.query(sql, params);
    } catch (error) {
      lastErr = error;

      // Only retry on transient connection errors
      if (!isTransientConnectionError(error)) {
        logger.error(
          `[DatabaseManager] Non-transient error in ${operationName}, not retrying`,
          error,
        );
        throw error;
      }

      if (attempt >= maxAttempts) break;

      const delay = Math.min(initialDelay * Math.pow(2, attempt - 1), 30_000);
      logger.warn(
        `[DatabaseManager] Query failed, retrying operation: ${operationName} (attempt ${attempt}/${maxAttempts})`,
        error,
      );
      await sleep(delay);
    }
  }

  throw lastErr;
}

/**
 * Execute a Drizzle query with retry logic for idempotent operations
 * @param queryFn - Function that returns a Drizzle query
 * @param options - Retry options
 * @returns Query result
 */
export async function withDbRetryDrizzle<T>(
  queryFn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelay?: number;
    forceRetry?: boolean;
    operationName?: string;
  } = {},
): Promise<T> {
  const {
    maxAttempts = QUERY_MAX_RETRY_ATTEMPTS,
    initialDelay = QUERY_INITIAL_RETRY_DELAY,
    forceRetry = false,
    operationName = 'drizzle-query',
  } = options;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await queryFn();
    } catch (error) {
      lastErr = error;

      // Only retry on transient connection errors
      if (!isTransientConnectionError(error)) {
        if (!forceRetry) {
          logger.warn(
            '[DatabaseManager] Non-transient error, not retrying',
            error,
          );
          throw error;
        }
      }

      if (attempt >= maxAttempts) break;

      const delay = Math.min(initialDelay * Math.pow(2, attempt - 1), 30_000);
      logger.warn(
        `[DatabaseManager] ${operationName} failed (attempt ${attempt}/${maxAttempts}). Retrying in ${delay}ms...`,
        error,
      );
      await sleep(delay);
    }
  }

  throw lastErr;
}

/**
 * Run a DB operation with exponential backoff retry.
 * NOTE: This should only be used for idempotent operations or with extreme caution
 */
export async function withDbRetry<T>(
  operation: () => Promise<T>,
  opName = 'db-operation',
  attempts = QUERY_MAX_RETRY_ATTEMPTS,
  initialDelay = QUERY_INITIAL_RETRY_DELAY,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastErr = error;

      // Only retry on transient connection errors
      if (!isTransientConnectionError(error)) {
        logger.warn(
          '[DatabaseManager] Non-transient error, not retrying',
          error,
        );
        throw error;
      }

      if (attempt >= attempts) break;

      const delay = Math.min(initialDelay * Math.pow(2, attempt - 1), 30_000);
      logger.warn(
        `[DatabaseManager] ${opName} failed (attempt ${attempt}/${attempts}). Retrying in ${delay}ms...`,
        error,
      );
      await sleep(delay);
    }
  }

  throw lastErr;
}

/**
 * Initializes the database connection with retry logic
 * @returns Promise resolving to true if connected successfully, false otherwise
 */
export async function initializeDatabaseConnection(): Promise<boolean> {
  try {
    // If an existing pool is present, test it first
    if (dbPool) {
      try {
        await dbPool.query('SELECT 1');
        isDbConnected = true;
        return true;
      } catch {
        logger.warn(
          '[DatabaseManager] Existing database connection is not responsive, creating a new one',
        );
        try {
          await dbPool.end();
        } catch (error) {
          logger.error('[DatabaseManager] Error ending pool', error);
        }
        dbPool = undefined;
      }
    }

    // Build connection candidates in preferred order
    const candidates: { label: string; connectionString: string }[] = [];
    const poolingConn = config.database.poolingDbConnectionString;
    const directConn = config.database.directDbConnectionString;

    if (poolingConn) {
      candidates.push({ label: 'pooling', connectionString: poolingConn });
    }
    if (directConn) {
      candidates.push({ label: 'direct', connectionString: directConn });
    }

    if (!candidates.length) {
      throw new Error(
        'No database connection string configured (pooling or direct).',
      );
    }

    // Attempt each candidate in order until one succeeds
    const sslOption = (() => {
      try {
        return {
          ca: fs.readFileSync(path.resolve('./certs/rootCA.pem')),
        };
      } catch (error) {
        logger.warn(
          '[DatabaseManager] Failed to load certificates for database, using insecure connection',
          error,
        );
        return undefined;
      }
    })();

    let lastError: any = null;
    for (const candidate of candidates) {
      logger.info(
        `[DatabaseManager] Attempting to connect using "${candidate.label}" connection string (length: ${candidate.connectionString.length})`,
      );
      const pool = new Pool({
        connectionString: candidate.connectionString,
        ssl: sslOption,
        connectionTimeoutMillis: 10000,
      });

      try {
        // Test connection with a simple idempotent query
        await withDbRetryQuery(pool, 'SELECT 1');
        dbPool = pool;
        db = drizzle({ client: dbPool, schema });
        logger.info(
          `[DatabaseManager] Successfully connected to database using "${candidate.label}" connection`,
        );
        isDbConnected = true;
        connectionAttempts = 0;

        if (hasNotifiedDbDisconnect && discordClient) {
          logManagerNotification(NotificationType.DATABASE_CONNECTION_RESTORED);
          notifyManagers(
            discordClient,
            NotificationType.DATABASE_CONNECTION_RESTORED,
          );
          hasNotifiedDbDisconnect = false;
        }

        return true;
      } catch (error) {
        lastError = error;
        logger.warn(
          `[DatabaseManager] Connection attempt with "${candidate.label}" failed`,
          error,
        );
        try {
          await pool.end();
        } catch (endErr) {
          logger.error(
            `[DatabaseManager] Error ending failed pool for "${candidate.label}"`,
            endErr,
          );
        }
      }
    }

    // If none of the candidates worked, throw last error to trigger retry logic
    throw lastError ?? new Error('All connection attempts failed.');
  } catch (error) {
    logger.error(
      `[DatabaseManager] Database connection error: ${(error as Error).message}`,
      error,
    );
    isDbConnected = false;
    connectionAttempts++;

    // Handle max retry attempts exceeded
    if (connectionAttempts >= MAX_DB_RETRY_ATTEMPTS) {
      if (!hasNotifiedDbDisconnect && discordClient) {
        logger.error(
          `[DatabaseManager] Failed to connect to database after ${connectionAttempts} attempts.`,
        );

        logManagerNotification(
          NotificationType.DATABASE_CONNECTION_LOST,
          `Error: ${error}`,
        );
        notifyManagers(
          discordClient,
          NotificationType.DATABASE_CONNECTION_LOST,
          `Connection attempts exhausted after ${connectionAttempts} tries. The bot cannot function without database access and will now terminate.`,
        );

        hasNotifiedDbDisconnect = true;
      }

      // Terminate after sending notifications
      setTimeout(() => {
        logger.log(
          'fatal',
          '[DatabaseManager] Database connection failed, shutting down bot',
        );
        process.exit(1);
      }, 3000);

      return false;
    }

    // Retry connection with exponential backoff
    const delay = Math.min(
      INITIAL_DB_RETRY_DELAY * Math.pow(2, connectionAttempts - 1),
      30000,
    );
    logger.info(
      `[DatabaseManager] Retrying database connection in ${delay}ms... (Attempt ${connectionAttempts}/${MAX_DB_RETRY_ATTEMPTS})`,
    );

    setTimeout(initializeDatabaseConnection, delay);

    return false;
  }
}

// Initialize database connection
let dbInitPromise = initializeDatabaseConnection().catch((error) => {
  logger.error('[DatabaseManager] Initial database connection failed', error);
  process.exit(1);
});

// ========================
// Helper Functions
// ========================

/**
 * Ensures the database is initialized and returns a promise
 * @returns Promise for database initialization
 */
export async function ensureDbInitialized(): Promise<void> {
  await dbInitPromise;

  if (!isDbConnected) {
    dbInitPromise = initializeDatabaseConnection();
    await dbInitPromise;
  }
}

/**
 * Checks if the database connection is active and working
 * @returns Promise resolving to true if connected, false otherwise
 */
export async function ensureDatabaseConnection(): Promise<boolean> {
  await ensureDbInitialized();

  if (!isDbConnected) {
    return await initializeDatabaseConnection();
  }

  try {
    if (!dbPool) {
      isDbConnected = false;
      return await initializeDatabaseConnection();
    }
    // Use the safe retry wrapper for connection testing
    await withDbRetryQuery(dbPool, 'SELECT 1');
    return true;
  } catch (error) {
    logger.error('[DatabaseManager] Database connection test failed', error);
    isDbConnected = false;
    return await initializeDatabaseConnection();
  }
}

/**
 * Generic error handler for database operations
 * @param errorMessage - Error message to log
 * @param error - Original error object
 * @throws {DatabaseError} - Always throws a wrapped database error
 */
export const handleDbError = (errorMessage: string, error: Error): never => {
  logger.error(`[DatabaseManager] ${errorMessage}:`, error);

  // Check if error is related to connection and attempt to reconnect
  if (
    error.message.includes('connection') ||
    error.message.includes('connect')
  ) {
    isDbConnected = false;
    ensureDatabaseConnection().catch((err) => {
      logger.error('[DatabaseManager] Failed to reconnect to database', err);
    });
  }

  throw new DatabaseError(errorMessage, error);
};

// ========================
// Cache Management
// ========================

/**
 * Checks and retrieves cached data or fetches from database
 * @param cacheKey - Key to check in cache
 * @param dbFetch - Function to fetch data from database
 * @param ttl - Time to live for cache in seconds
 * @returns Cached or freshly fetched data
 */
export async function withCache<T>(
  cacheKey: string,
  dbFetch: () => Promise<T>,
  ttl?: number,
): Promise<T> {
  try {
    const cachedData = await getJson<T>(cacheKey);
    if (cachedData !== null) {
      return cachedData;
    }
  } catch (error) {
    logger.warn(
      `[DatabaseManager] Cache retrieval failed for ${cacheKey}, falling back to database`,
      error,
    );
  }

  const data = await dbFetch();

  try {
    await setJson(cacheKey, data, ttl);
  } catch (error) {
    logger.warn(`[DatabaseManager] Failed to cache data for ${cacheKey}`, {
      error,
      stack: (error as Error).stack,
    });
  }

  return data;
}

/**
 * Invalidates a cache key if it exists
 * @param cacheKey - Key to invalidate
 */
export async function invalidateCache(cacheKey: string): Promise<void> {
  try {
    if (await exists(cacheKey)) {
      await del(cacheKey);
    }
  } catch (error) {
    logger.warn(
      `[DatabaseManager] Error invalidating cache for key ${cacheKey}:`,
      error,
    );
  }
}

// ========================
// Database Functions Exports
// ========================

// Achievement related functions
export * from './functions/achievementFunctions.js';

// Facts system functions
export * from './functions/factFunctions.js';

// Giveaway management functions
export * from './functions/giveawayFunctions.js';

// User leveling system functions
export * from './functions/levelFunctions.js';

// Guild member management functions
export * from './functions/memberFunctions.js';

// Moderation and administration functions
export * from './functions/moderationFunctions.js';
