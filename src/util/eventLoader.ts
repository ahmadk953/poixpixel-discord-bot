import { Client } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

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
      (file) => file.endsWith('.js') || file.endsWith('.ts'),
    );

    for (const file of eventFiles) {
      const filePath = join(eventsPath, file);
      const eventModule = await import(`file://${filePath}`);

      const events =
        eventModule.default || eventModule[`${file.split('.')[0]}Events`];

      const eventArray = Array.isArray(events) ? events : [events];

      for (const event of eventArray) {
        if (!event?.name) {
          console.warn(`Event in ${filePath} is missing a name property`);
          continue;
        }

        if (event.once) {
          client.once(event.name, (...args) => event.execute(...args));
        } else {
          client.on(event.name, (...args) => event.execute(...args));
        }

        console.log(`Registered event: ${event.name}`);
      }
    }
  } catch (error) {
    console.error('Error registering events:', error);
    throw error;
  }
}
