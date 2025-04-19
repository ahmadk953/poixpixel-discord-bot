import fs from 'node:fs';
import path from 'node:path';
import Redis from 'ioredis';
import { Client } from 'discord.js';

import { loadConfig } from '@/util/configLoader.js';
import {
  logManagerNotification,
  NotificationType,
  notifyManagers,
} from '@/util/notificationHandler.js';

const config = loadConfig();

// Redis connection state
let isRedisAvailable = false;
let redis: Redis;
let connectionAttempts = 0;
const MAX_RETRY_ATTEMPTS = config.redis.retryAttempts;
const INITIAL_RETRY_DELAY = config.redis.initialRetryDelay;
let hasNotifiedDisconnect = false;
let discordClient: Client | null = null;

// ========================
// Redis Utility Classes and Helper Functions
// ========================

/**
 * Custom error class for Redis errors
 */
class RedisError extends Error {
  constructor(
    message: string,
    public originalError?: Error,
  ) {
    super(message);
    this.name = 'RedisError';
  }
}

/**
 * Redis error handler
 * @param errorMessage - The error message to log
 * @param error - The error object
 */
const handleRedisError = (errorMessage: string, error: Error): null => {
  console.error(`${errorMessage}:`, error);
  throw new RedisError(errorMessage, error);
};

/**
 * Sets the Discord client for sending notifications
 * @param client - The Discord client
 */
export function setDiscordClient(client: Client): void {
  discordClient = client;
}

/**
 * Initializes the Redis connection with retry logic
 */
async function initializeRedisConnection() {
  try {
    if (redis && redis.status !== 'end' && redis.status !== 'close') {
      return;
    }

    redis = new Redis(config.redis.redisConnectionString, {
      retryStrategy(times) {
        connectionAttempts = times;
        if (times >= MAX_RETRY_ATTEMPTS) {
          const message = `Failed to connect to Redis after ${times} attempts. Caching will be disabled.`;
          console.warn(message);

          if (!hasNotifiedDisconnect && discordClient) {
            logManagerNotification(NotificationType.REDIS_CONNECTION_LOST);
            notifyManagers(
              discordClient,
              NotificationType.REDIS_CONNECTION_LOST,
              `Connection attempts exhausted after ${times} tries. Caching is now disabled.`,
            );
            hasNotifiedDisconnect = true;
          }

          return null;
        }

        const delay = Math.min(INITIAL_RETRY_DELAY * Math.pow(2, times), 30000);
        console.log(
          `Retrying Redis connection in ${delay}ms... (Attempt ${times + 1}/${MAX_RETRY_ATTEMPTS})`,
        );
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableOfflineQueue: true,
      tls: (() => {
        try {
          return {
            ca: fs.readFileSync(path.resolve('./certs/cache-ca.crt')),
            key: fs.readFileSync(path.resolve('./certs/cache-client.key')),
            cert: fs.readFileSync(path.resolve('./certs/cache-server.crt')),
          };
        } catch (error) {
          console.warn(
            'Failed to load certificates for cache, using insecure connection:',
            error,
          );
          return undefined;
        }
      })(),
    });

    // ========================
    // Redis Events
    // ========================
    redis.on('error', (error: Error) => {
      console.error('Redis Connection Error:', error);
      isRedisAvailable = false;
    });

    redis.on('connect', () => {
      console.info('Successfully connected to Redis');
      isRedisAvailable = true;
      connectionAttempts = 0;

      if (hasNotifiedDisconnect && discordClient) {
        logManagerNotification(NotificationType.REDIS_CONNECTION_RESTORED);
        notifyManagers(
          discordClient,
          NotificationType.REDIS_CONNECTION_RESTORED,
        );
        hasNotifiedDisconnect = false;
      }
    });

    redis.on('close', () => {
      console.warn('Redis connection closed');
      isRedisAvailable = false;

      // Try to reconnect after some time if we've not exceeded max attempts
      if (connectionAttempts < MAX_RETRY_ATTEMPTS) {
        const delay = Math.min(
          INITIAL_RETRY_DELAY * Math.pow(2, connectionAttempts),
          30000,
        );
        setTimeout(initializeRedisConnection, delay);
      } else if (!hasNotifiedDisconnect && discordClient) {
        logManagerNotification(NotificationType.REDIS_CONNECTION_LOST);
        notifyManagers(
          discordClient,
          NotificationType.REDIS_CONNECTION_LOST,
          'Connection closed and max retry attempts reached.',
        );
        hasNotifiedDisconnect = true;
      }
    });

    redis.on('reconnecting', () => {
      console.info('Attempting to reconnect to Redis...');
    });
  } catch (error) {
    console.error('Failed to initialize Redis:', error);
    isRedisAvailable = false;

    if (!hasNotifiedDisconnect && discordClient) {
      logManagerNotification(
        NotificationType.REDIS_CONNECTION_LOST,
        `Error: ${error}`,
      );
      notifyManagers(
        discordClient,
        NotificationType.REDIS_CONNECTION_LOST,
        `Initialization error: ${error}`,
      );
      hasNotifiedDisconnect = true;
    }
  }
}

// Initialize Redis connection
initializeRedisConnection();

/**
 * Check if Redis is currently available, and attempt to reconnect if not
 * @returns - True if Redis is connected and available
 */
export async function ensureRedisConnection(): Promise<boolean> {
  if (!isRedisAvailable) {
    await initializeRedisConnection();
  }
  return isRedisAvailable;
}

// ========================
// Redis Functions
// ========================

/**
 * Function to set a key in Redis
 * @param key - The key to set
 * @param value - The value to set
 * @param ttl - The time to live for the key
 * @returns - 'OK' if successful
 */
export async function set(
  key: string,
  value: string,
  ttl?: number,
): Promise<'OK' | null> {
  if (!(await ensureRedisConnection())) {
    console.warn('Redis unavailable, skipping set operation');
    return null;
  }

  try {
    await redis.set(`bot:${key}`, value);
    if (ttl) await redis.expire(`bot:${key}`, ttl);
    return 'OK';
  } catch (error) {
    return handleRedisError(`Failed to set key: ${key}`, error as Error);
  }
}

/**
 * Function to set a key in Redis with a JSON value
 * @param key - The key to set
 * @param value - The value to set
 * @param ttl - The time to live for the key
 * @returns - 'OK' if successful
 */
export async function setJson<T>(
  key: string,
  value: T,
  ttl?: number,
): Promise<'OK' | null> {
  return await set(key, JSON.stringify(value), ttl);
}

/**
 * Increments a key in Redis
 * @param key - The key to increment
 * @returns - The new value of the key, or null if Redis is unavailable
 */
export async function incr(key: string): Promise<number | null> {
  if (!(await ensureRedisConnection())) {
    console.warn('Redis unavailable, skipping increment operation');
    return null;
  }

  try {
    return await redis.incr(`bot:${key}`);
  } catch (error) {
    return handleRedisError(`Failed to increment key: ${key}`, error as Error);
  }
}

/**
 * Checks if a key exists in Redis
 * @param key - The key to check
 * @returns - True if the key exists, false otherwise, or null if Redis is unavailable
 */
export async function exists(key: string): Promise<boolean | null> {
  if (!(await ensureRedisConnection())) {
    console.warn('Redis unavailable, skipping exists operation');
    return null;
  }

  try {
    return (await redis.exists(`bot:${key}`)) === 1;
  } catch (error) {
    return handleRedisError(
      `Failed to check if key exists: ${key}`,
      error as Error,
    );
  }
}

/**
 * Gets the value of a key in Redis
 * @param key - The key to get
 * @returns - The value of the key, or null if the key does not exist or Redis is unavailable
 */
export async function get(key: string): Promise<string | null> {
  if (!(await ensureRedisConnection())) {
    console.warn('Redis unavailable, skipping get operation');
    return null;
  }

  try {
    return await redis.get(`bot:${key}`);
  } catch (error) {
    return handleRedisError(`Failed to get key: ${key}`, error as Error);
  }
}

/**
 * Gets the values of multiple keys in Redis
 * @param keys - The keys to get
 * @returns - The values of the keys, or null if Redis is unavailable
 */
export async function mget(
  ...keys: string[]
): Promise<(string | null)[] | null> {
  if (!(await ensureRedisConnection())) {
    console.warn('Redis unavailable, skipping mget operation');
    return null;
  }

  try {
    return await redis.mget(...keys.map((key) => `bot:${key}`));
  } catch (error) {
    return handleRedisError('Failed to get keys', error as Error);
  }
}

/**
 * Gets the value of a key in Redis and parses it as a JSON object
 * @param key - The key to get
 * @returns - The parsed JSON value of the key, or null if the key does not exist or Redis is unavailable
 */
export async function getJson<T>(key: string): Promise<T | null> {
  const value = await get(key);
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/**
 * Deletes a key in Redis
 * @param key - The key to delete
 * @returns - The number of keys that were deleted, or null if Redis is unavailable
 */
export async function del(key: string): Promise<number | null> {
  if (!(await ensureRedisConnection())) {
    console.warn('Redis unavailable, skipping delete operation');
    return null;
  }

  try {
    return await redis.del(`bot:${key}`);
  } catch (error) {
    return handleRedisError(`Failed to delete key: ${key}`, error as Error);
  }
}

/**
 * Check if Redis is currently available
 * @returns - True if Redis is connected and available
 */
export function isRedisConnected(): boolean {
  return isRedisAvailable;
}
