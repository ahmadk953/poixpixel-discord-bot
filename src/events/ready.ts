import { type Client, Events } from 'discord.js';

import { ensureDbInitialized, setMembers } from '@/db/db.js';
import { loadConfig } from '@/util/configLoader.js';
import type { Event } from '@/types/EventTypes.js';
import { scheduleFactOfTheDay } from '@/util/factManager.js';
import { scheduleGiveaways } from '@/util/giveaways/giveawayManager.js';

import {
  ensureRedisConnection,
  setDiscordClient as setRedisDiscordClient,
} from '@/db/redis.js';
import { setDiscordClient as setDbDiscordClient } from '@/db/db.js';
import { loadActiveBans, loadActiveMutes } from '@/util/helpers.js';
import { rehydrateCountingAutoUnbans } from '@/util/counting/countingManager.js';
import { logger } from '@/util/logger.js';

export default {
  name: Events.ClientReady,
  once: true,
  execute: async (client: Client) => {
    try {
      const config = loadConfig();
      setRedisDiscordClient(client);
      setDbDiscordClient(client);

      await ensureDbInitialized();
      await ensureRedisConnection();

      const guild = client.guilds.cache.find(
        (guilds) => guilds.id === config.guildId,
      );

      if (!guild) {
        logger.log(
          'fatal',
          `[ReadyEvent] Guild with ID ${config.guildId} not found. Exiting.`,
        );
        process.exit(1);
      }

      const members = await guild.members.fetch();
      const nonBotMembers = members.filter((m) => !m.user.bot);
      await setMembers(nonBotMembers);

      await loadActiveBans(client, guild);
      await loadActiveMutes(client, guild);

      await rehydrateCountingAutoUnbans(client);

      await scheduleFactOfTheDay(client);
      await scheduleGiveaways(client);

      logger.info(`[ReadyEvent] Ready! Logged in as ${client.user?.tag}`);
    } catch (error) {
      logger.log('fatal', '[ReadyEvent] Failed to initialize the bot', error);
      process.exit(1);
    }
  },
} as Event<typeof Events.ClientReady>;
