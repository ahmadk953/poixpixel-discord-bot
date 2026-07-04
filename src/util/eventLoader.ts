import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { type Client, Events } from 'discord.js';

import { logger } from './logger.js';
import { requestShutdown } from './shutdown.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Registers all event handlers in the events directory
 * @param client - The Discord client
 */
export async function registerEvents(client: Client): Promise<void> {
  try {
    const eventsPath = join(__dirname, '..', 'events');
    const eventFiles = readdirSync(eventsPath).filter(
      (file) => file.endsWith('.js') || file.endsWith('.ts')
    );

    for (const file of eventFiles) {
      const filePath = join(eventsPath, file);
      const eventModule = await import(`file://${filePath}`);

      const events =
        eventModule.default ?? eventModule[`${file.split('.')[0]}Events`];

      const eventArray = Array.isArray(events) ? events : [events];

      for (const event of eventArray) {
        if (!event?.name) {
          logger.warn(
            `[EventLoader] Event in ${filePath} is missing a name property`
          );
          continue;
        }

        if (event.once) {
          client.once(event.name, (...args) => {
            event.execute(...args).catch(async (error: unknown) => {
              logger.error(
                `[EventLoader] Error executing one-time event: ${event.name}`,
                error
              );

              if (event.name === Events.ClientReady) {
                await requestShutdown(1);
              }
            });
          });
        } else {
          client.on(event.name, (...args) => {
            event.execute(...args).catch((error: unknown) => {
              logger.error(
                `[EventLoader] Error executing event: ${event.name}`,
                error
              );
            });
          });
        }

        logger.debug(`[EventLoader] Registered event: ${event.name}`);
      }
    }
  } catch (error) {
    logger.error('[EventLoader] Error registering events', error);
    throw error;
  }
}
