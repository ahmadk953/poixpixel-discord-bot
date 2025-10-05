import { GatewayIntentBits } from 'discord.js';
import { ExtendedClient } from '@/structures/ExtendedClient.js';
import { loadConfig } from '@/util/configLoader.js';
import { initLogger, logger } from '@/util/logger.js';

// Minimal synchronous fallback logger to guarantee we can emit errors
const _fallbackLogger = {
  log: (level: string, message?: unknown, ...meta: unknown[]) => {
    const prefix = level ? `[${level}]` : '[log]';
    const parts = [prefix, message];
    if (meta?.length) {
      parts.push(
        ...meta.map((m) =>
          typeof m === 'object' ? JSON.stringify(m) : String(m),
        ),
      );
    }
    process.stderr.write(`${parts.join(' ')}\n`);
  },
  error: (message?: unknown, ...meta: unknown[]) => {
    const parts = [message];
    if (meta?.length) {
      parts.push(
        ...meta.map((m) =>
          typeof m === 'object' ? JSON.stringify(m) : String(m),
        ),
      );
    }
    process.stderr.write(`${parts.join(' ')}\n`);
  },
};

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
    if (msg || stack) return [msg, stack].filter(Boolean).join('\n');

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
async function startBot() {
  try {
    try {
      initLogger();
    } catch (initErr) {
      const errMsg = formatError(initErr);
      process.stderr.write(
        `Failed to initialize logger, continuing with console fallback: ${errMsg}\n`,
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
      config,
    );

    await client.initialize();
  } catch (error) {
    // Use exported logger when available, otherwise fall back to console
    const activeLogger: typeof _fallbackLogger | typeof logger =
      typeof logger !== 'undefined' &&
      logger &&
      typeof (logger as typeof _fallbackLogger).log === 'function'
        ? logger
        : _fallbackLogger;

    if (typeof activeLogger.log === 'function') {
      try {
        activeLogger.log('fatal', '[mainBot] Failed to start bot', error);
      } catch (e) {
        const errorMsg = formatError(error);
        const eMsg = formatError(e);
        process.stderr.write(
          `[mainBot] Failed to start bot ${errorMsg}\nAlso failed to log via logger: ${eMsg}\n`,
        );
      }
    } else if (typeof activeLogger.error === 'function') {
      activeLogger.error('[mainBot] Failed to start bot', error);
    } else {
      const errorMsg = formatError(error);
      process.stderr.write(`[mainBot] Failed to start bot ${errorMsg}\n`);
    }

    process.exit(1);
  }
}

await startBot();
