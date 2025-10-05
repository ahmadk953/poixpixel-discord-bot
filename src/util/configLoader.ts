import fs from 'node:fs';
import path from 'node:path';

import type { Config } from '@/types/ConfigTypes.js';
import type { Logger } from 'winston';

let cachedConfig: Config | null = null;
let configLoadTime: number | null = null;
let loggerModule: { logger: Logger } | null = null;

/**
 * Lazy-load the logger to break circular dependency
 * @returns - The logger instance, loading the module if necessary
 */
async function getLogger(): Promise<Logger> {
  if (loggerModule === null) {
    const mod = await import('./logger.js');
    loggerModule = { logger: mod.logger };
  }
  return loggerModule.logger;
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
    // Log asynchronously but exit immediately
    getLogger()
      .then((logger) => {
        logger.log('fatal', '[ConfigLoader] Failed to load config', error);
      })
      .catch(() => {
        // Fallback to stderr if logger not available
        const errMsg = error instanceof Error ? error.message : String(error);
        process.stderr.write(
          `[ConfigLoader] Failed to load config: ${errMsg}\n`,
        );
      });
    process.exit(1);
  }
}

/**
 * Reloads the configuration from disk and updates the cache
 * @returns - The newly loaded config object
 */
export async function reloadConfig(): Promise<Config> {
  const logger = await getLogger();
  logger.info('Reloading configuration from disk...');
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
