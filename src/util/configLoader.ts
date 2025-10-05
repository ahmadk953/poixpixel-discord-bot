import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

import type { Config } from '@/types/ConfigTypes.js';
import type { Logger } from 'winston';

const require = createRequire(import.meta.url);

let cachedConfig: Config | null = null;
let configLoadTime: number | null = null;
let loggerModule: { logger: Logger } | null = null;

// Lazy-load the logger to break circular dependency
function getLogger(): Logger {
  loggerModule ??= require('./logger.js') as { logger: Logger };
  return (loggerModule as { logger: Logger }).logger;
}

/**
 * Loads the config file from disk and caches it in memory
 * @param forceReload - Force reload from disk even if cached
 * @returns - The loaded config object
 */
export function loadConfig(forceReload = false): Config {
  if (cachedConfig !== null && !forceReload) {
    return cachedConfig;
  }

  try {
    const configPath = path.join(process.cwd(), './config.json');
    const configFile = fs.readFileSync(configPath, 'utf8');
    const config: Config = JSON.parse(configFile);

    const requiredFields = ['token', 'clientId', 'guildId'];
    for (const field of requiredFields) {
      if (!config[field as keyof Config]) {
        throw new Error(`Missing required config field: ${field}`);
      }
    }

    cachedConfig = config;
    configLoadTime = Date.now();

    return config;
  } catch (error) {
    getLogger().log('fatal', '[ConfigLoader] Failed to load config', error);
    process.exit(1);
  }
}

/**
 * Reloads the configuration from disk and updates the cache
 * @returns - The newly loaded config object
 */
export function reloadConfig(): Config {
  getLogger().info('Reloading configuration from disk...');
  return loadConfig(true);
}

/**
 * Gets the cached configuration without reloading from disk
 * @returns - The cached config object or null if not loaded
 */
export function getCachedConfig(): Config | null {
  return cachedConfig;
}

/**
 * Gets the timestamp when the config was last loaded
 * @returns - Unix timestamp of last config load or null if never loaded
 */
export function getConfigLoadTime(): number | null {
  return configLoadTime;
}

/**
 * Clears the cached configuration (mainly for testing purposes)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
  configLoadTime = null;
}
