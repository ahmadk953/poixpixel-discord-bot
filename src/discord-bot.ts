/* eslint-disable no-console */
import { GatewayIntentBits } from 'discord.js';
import { ExtendedClient } from '@/structures/ExtendedClient.js';
import { loadConfig } from '@/util/configLoader.js';
import { initLogger, logger } from '@/util/logger.js';

// Minimal synchronous fallback logger to guarantee we can emit errors
const _fallbackLogger = {
  log: (level: string, message?: any, ...meta: any[]) => {
    const prefix = level ? `[${level}]` : '[log]';
    if (meta && meta.length) console.error(prefix, message, ...meta);
    else console.error(prefix, message);
  },
  error: (message?: any, ...meta: any[]) => {
    if (meta && meta.length) console.error(message, ...meta);
    else console.error(message);
  },
};

async function startBot() {
  try {
    // initLogger may throw - catch and continue with console fallback so
    // the rest of startup can still run and any later errors can be logged.
    try {
      initLogger();
    } catch (initErr) {
      // Write to console directly here because logger initialization failed
      // and the exported `logger` may be unreliable.
      console.error(
        'Failed to initialize logger, continuing with console fallback:',
        initErr,
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
    const activeLogger: any =
      typeof logger !== 'undefined' &&
      logger &&
      typeof (logger as any).log === 'function'
        ? logger
        : _fallbackLogger;

    if (typeof activeLogger.log === 'function') {
      try {
        activeLogger.log('fatal', '[mainBot] Failed to start bot', error);
      } catch (e) {
        console.error(
          '[mainBot] Failed to start bot',
          error,
          '\nAlso failed to log via logger:',
          e,
        );
      }
    } else if (typeof activeLogger.error === 'function') {
      activeLogger.error('[mainBot] Failed to start bot', error);
    } else {
      console.error('[mainBot] Failed to start bot', error);
    }

    process.exit(1);
  }
}

await startBot();
