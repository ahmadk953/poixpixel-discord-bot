import { GatewayIntentBits } from 'discord.js';
import { ExtendedClient } from '@/structures/ExtendedClient.js';
import { loadConfig } from '@/util/configLoader.js';
import { initLogger, logger } from '@/util/logger.js';

// Minimal synchronous fallback logger to guarantee we can emit errors
const _fallbackLogger = {
  log: (level: string, message?: any, ...meta: any[]) => {
    const prefix = level ? `[${level}]` : '[log]';
    const parts = [prefix, message];
    if (meta && meta.length) {
      parts.push(
        ...meta.map((m) =>
          typeof m === 'object' ? JSON.stringify(m) : String(m),
        ),
      );
    }
    process.stderr.write(parts.join(' ') + '\n');
  },
  error: (message?: any, ...meta: any[]) => {
    const parts = [message];
    if (meta && meta.length) {
      parts.push(
        ...meta.map((m) =>
          typeof m === 'object' ? JSON.stringify(m) : String(m),
        ),
      );
    }
    process.stderr.write(parts.join(' ') + '\n');
  },
};

async function startBot() {
  try {
    try {
      initLogger();
    } catch (initErr) {
      const errMsg =
        typeof initErr === 'object' ? JSON.stringify(initErr) : String(initErr);
      process.stderr.write(
        'Failed to initialize logger, continuing with console fallback: ' +
          errMsg +
          '\n',
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
        const errorMsg =
          typeof error === 'object' ? JSON.stringify(error) : String(error);
        const eMsg = typeof e === 'object' ? JSON.stringify(e) : String(e);
        process.stderr.write(
          '[mainBot] Failed to start bot ' +
            errorMsg +
            '\nAlso failed to log via logger: ' +
            eMsg +
            '\n',
        );
      }
    } else if (typeof activeLogger.error === 'function') {
      activeLogger.error('[mainBot] Failed to start bot', error);
    } else {
      const errorMsg =
        typeof error === 'object' ? JSON.stringify(error) : String(error);
      process.stderr.write('[mainBot] Failed to start bot ' + errorMsg + '\n');
    }

    process.exit(1);
  }
}

await startBot();
