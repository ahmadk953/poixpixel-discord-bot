import { GatewayIntentBits } from 'discord.js';

import { ExtendedClient } from '@/structures/ExtendedClient.js';
import { loadConfig } from '@/util/configLoader.js';
import { initLogger, logger } from '@/util/logger.js';
import { requestShutdown } from '@/util/shutdown.js';

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
  let client: ExtendedClient | undefined;

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

    client = new ExtendedClient(
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

      try {
        await requestShutdown(0, client);
        logger.info('[MainBot] Graceful shutdown completed.');
      } catch (error) {
        logger.error('[MainBot] Error during graceful shutdown:', { error });
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

    await requestShutdown(1, client);
  }
}

await botProcess();
