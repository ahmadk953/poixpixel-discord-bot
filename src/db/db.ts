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

// ========================
// Connection State Variables
// ========================
let isDbConnected = false;
let connectionAttempts = 0;
let hasNotifiedDbDisconnect = false;
let discordClient: Client | null = null;
let dbPool: pkg.Pool;
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
    // Check if existing connection is working
    if (dbPool) {
      try {
        await dbPool.query('SELECT 1');
        isDbConnected = true;
        return true;
      } catch (error) {
        console.warn(
          'Existing database connection is not responsive, creating a new one',
        );
        try {
          await dbPool.end();
        } catch (endError) {
          console.error('Error ending pool:', endError);
        }
      }
    }

    // Log the database connection attempt
    console.log(
      `Connecting to database... (connectionString length: ${config.database.dbConnectionString.length})`,
    );

    // Create new connection pool
    dbPool = new Pool({
      connectionString: config.database.dbConnectionString,
      ssl: (() => {
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
      })(),
      connectionTimeoutMillis: 10000,
    });

    // Test connection
    await dbPool.query('SELECT 1');

    // Initialize Drizzle ORM
    db = drizzle({ client: dbPool, schema });

    // Connection successful
    console.info('Successfully connected to database');
    isDbConnected = true;
    connectionAttempts = 0;

    // Send notification if connection was previously lost
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
