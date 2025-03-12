import Redis from 'ioredis';
import { loadConfig } from '../util/configLoader.js';

const config = loadConfig();
const redis = new Redis(config.redisConnectionString);

class RedisError extends Error {
  constructor(
    message: string,
    public originalError?: Error,
  ) {
    super(message);
    this.name = 'RedisError';
  }
}

redis.on('error', (error: Error) => {
  console.error('Redis connection error:', error);
  throw new RedisError('Failed to connect to Redis instance: ', error);
});

redis.on('connect', () => {
  console.log('Successfully connected to Redis');
});

export async function set(
  key: string,
  value: string,
  ttl?: number,
): Promise<'OK'> {
  try {
    await redis.set(key, value);
    if (ttl) await redis.expire(key, ttl);
  } catch (error) {
    console.error('Redis set error: ', error);
    throw new RedisError(`Failed to set key: ${key}, `, error as Error);
  }
  return Promise.resolve('OK');
}

export async function setJson<T>(
  key: string,
  value: T,
  ttl?: number,
): Promise<'OK'> {
  return await set(key, JSON.stringify(value), ttl);
}

export async function incr(key: string): Promise<number> {
  try {
    return await redis.incr(key);
  } catch (error) {
    console.error('Redis increment error: ', error);
    throw new RedisError(`Failed to increment key: ${key}, `, error as Error);
  }
}

export async function exists(key: string): Promise<boolean> {
  try {
    return (await redis.exists(key)) === 1;
  } catch (error) {
    console.error('Redis exists error: ', error);
    throw new RedisError(
      `Failed to check if key exists: ${key}, `,
      error as Error,
    );
  }
}

export async function get(key: string): Promise<string | null> {
  try {
    return await redis.get(key);
  } catch (error) {
    console.error('Redis get error: ', error);
    throw new RedisError(`Failed to get key: ${key}, `, error as Error);
  }
}

export async function mget(...keys: string[]): Promise<(string | null)[]> {
  try {
    return await redis.mget(keys);
  } catch (error) {
    console.error('Redis mget error: ', error);
    throw new RedisError(`Failed to get keys: ${keys}, `, error as Error);
  }
}

export async function getJson<T>(key: string): Promise<T | null> {
  const value = await get(key);
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export async function del(key: string): Promise<number> {
  try {
    return await redis.del(key);
  } catch (error) {
    console.error('Redis del error: ', error);
    throw new RedisError(`Failed to delete key: ${key}, `, error as Error);
  }
}
