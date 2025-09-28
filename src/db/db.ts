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
        console.warn(
          'Existing database connection is not responsive, creating a new one',
        );
        try {
          await dbPool.end();
        } catch (endError) {
          console.error('Error ending pool:', endError);
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
        console.warn(
          'Failed to load certificates for database, using insecure connection:',
          error,
        );
        return undefined;
      }
    })();

    let lastError: any = null;
    for (const candidate of candidates) {
      console.log(
        `Attempting to connect using "${candidate.label}" connection string (length: ${candidate.connectionString.length})`,
      );
      const pool = new Pool({
        connectionString: candidate.connectionString,
        ssl: sslOption,
        connectionTimeoutMillis: 10000,
      });

      // Wrap pool.query with retry
      const originalPoolQuery = pool.query.bind(pool);
      (pool as any).query = (...args: any[]) =>
        withDbRetry(
          () => (originalPoolQuery as any).apply(pool, args as any),
          'pool.query',
          QUERY_MAX_RETRY_ATTEMPTS,
          QUERY_INITIAL_RETRY_DELAY,
        );

      // Also wrap transaction clients
      pool.on('connect', (client: any) => {
        const originalClientQuery = client.query.bind(client);
        client.query = (...args: any[]) =>
          withDbRetry(
            () => (originalClientQuery as any).apply(client, args as any),
            'client.query',
            QUERY_MAX_RETRY_ATTEMPTS,
            QUERY_INITIAL_RETRY_DELAY,
          );
      });

      try {
        // Test connection (uses the retry-wrapped pool.query)
        await pool.query('SELECT 1');
        dbPool = pool;
        db = drizzle({ client: dbPool, schema });
        console.info(
          `Successfully connected to database using "${candidate.label}" connection`,
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
      } catch (err) {
        lastError = err;
        console.warn(
          `Connection attempt with "${candidate.label}" failed:`,
          err,
        );
        try {
          await pool.end();
        } catch (endErr) {
          console.error(
            `Error ending failed pool for "${candidate.label}":`,
            endErr,
          );
        }
      }
    }

    // If none of the candidates worked, throw last error to trigger retry logic
    throw lastError ?? new Error('All connection attempts failed.');
  } catch (error) {
    console.error('Failed to connect to database:', error);
    isDbConnected = false;
    connectionAttempts++;

    // Handle max retry attempts exceeded
    if (connectionAttempts >= MAX_DB_RETRY_ATTEMPTS) {
      if (!hasNotifiedDbDisconnect && discordClient) {
        const message = `Failed to connect to database after ${connectionAttempts} attempts.`;
        console.error(message);
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
        console.error('Database connection failed, shutting down bot');
        process.exit(1);
      }, 3000);

      return false;
    }

    // Retry connection with exponential backoff
    const delay = Math.min(
      INITIAL_DB_RETRY_DELAY * Math.pow(2, connectionAttempts - 1),
      30000,
    );
    console.log(
      `Retrying database connection in ${delay}ms... (Attempt ${connectionAttempts}/${MAX_DB_RETRY_ATTEMPTS})`,
    );

    setTimeout(initializeDatabaseConnection, delay);

    return false;
  }
}

// Initialize database connection
let dbInitPromise = initializeDatabaseConnection().catch((error) => {
  console.error('Failed to initialize database connection:', error);
  process.exit(1);
});

// ========================
// Helper Functions
// ========================

/**
 * Sleep for a given number of milliseconds.
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after the specified delay
 */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Run a DB operation with exponential backoff retry.
 * Defaults come from config.database.queryRetryAttempts/queryRetryInitialDelay.
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
    } catch (err) {
      lastErr = err;
      if (attempt >= attempts) break;

      const delay = Math.min(initialDelay * Math.pow(2, attempt - 1), 30_000);
      console.warn(
        `[withDbRetry] ${opName} failed (attempt ${attempt}/${attempts}). Retrying in ${delay}ms...`,
        err,
      );
      await sleep(delay);
    }
  }

  throw lastErr;
}

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
    await dbPool.query('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
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
  console.error(`${errorMessage}:`, error);

  // Check if error is related to connection and attempt to reconnect
  if (
    error.message.includes('connection') ||
    error.message.includes('connect')
  ) {
    isDbConnected = false;
    ensureDatabaseConnection().catch((err) => {
      console.error('Failed to reconnect to database:', err);
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
    console.warn(
      `Cache retrieval failed for ${cacheKey}, falling back to database:`,
      error,
    );
  }

  const data = await dbFetch();

  try {
    await setJson(cacheKey, data, ttl);
  } catch (error) {
    console.warn(`Failed to cache data for ${cacheKey}:`, error);
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
    console.warn(`Error invalidating cache for key ${cacheKey}:`, error);
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
