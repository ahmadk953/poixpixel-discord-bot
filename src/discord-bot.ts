import { GatewayIntentBits } from 'discord.js';

import { ExtendedClient } from '@/structures/ExtendedClient.js';
import { loadConfig } from '@/util/configLoader.js';
import { initLogger, logger } from '@/util/logger.js';
import { closeDbConnection } from './db/db.js';
import { closeRedisConnection } from './db/redis.js';

/**
 * Formats an unknown error-like value into a useful string.
 * @param err The error to format
 * @returns The formatted error string
 */
function formatError(err: unknown): string {
  if (err instanceof Error) {
    return err.stack ?? err.message ?? String(err);
  }

  if (err && typeof err === 'object') {
    const anyErr = err as Record<string, unknown>;
    const msg = typeof anyErr.message === 'string' ? anyErr.message : '';
    const stack = typeof anyErr.stack === 'string' ? anyErr.stack : '';
    if (msg || stack) {
      return [msg, stack].filter(Boolean).join('\n');
    }

    try {
      return JSON.stringify(anyErr);
    } catch {
      return String(err);
    }
  }

  return String(err);
}

/**
 * Starts the Discord bot.
 */
async function botProcess() {
  try {
    try {
      initLogger();
    } catch (initErr) {
      const errMsg = formatError(initErr);
      process.stderr.write(
        `[MainBot] Failed to initialize logger, continuing with console fallback: ${errMsg}\n`
      );
    }

    const config = loadConfig();

    const client = new ExtendedClient(
      {
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMembers,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.GuildModeration,
          GatewayIntentBits.GuildInvites,
          GatewayIntentBits.MessageContent,
          GatewayIntentBits.GuildMessageReactions,
        ],
      },
      config
    );

    await client.initialize();

    const shutdown = async (signal: string) => {
      logger.info(`[MainBot] Received ${signal}, shutting down...`);

      const forceQuitTimeout = setTimeout(() => {
        logger.warn('[MainBot] Shutdown timed out, forcing exit...');
        process.exit(1);
      }, 10_000);

      try {
        await client.destroy();
        await closeDbConnection();
        await closeRedisConnection();
        logger.info('[MainBot] Graceful shutdown completed.');
      } catch (error) {
        logger.error('[MainBot] Error during graceful shutdown:', { error });
      } finally {
        clearTimeout(forceQuitTimeout);
        process.exit(0);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    try {
      logger.log('fatal', '[MainBot] Failed to start bot', { error });
    } catch (logError) {
      // Absolute fallback if the logger itself crashes
      process.stderr.write(
        `[MainBot] Critical failure during startup: ${formatError(error)}\n`
      );
      if (logError) {
        process.stderr.write(
          `[MainBot] Logger also failed: ${formatError(logError)}\n`
        );
      }
    }

    process.exit(1);
  }
}

await botProcess();
