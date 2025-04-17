import { Client, Events } from 'discord.js';

import { ensureDbInitialized, setMembers } from '@/db/db.js';
import { loadConfig } from '@/util/configLoader.js';
import { Event } from '@/types/EventTypes.js';
import { scheduleFactOfTheDay } from '@/util/factManager.js';
import { scheduleGiveaways } from '@/util/giveaways/giveawayManager.js';

import {
  ensureRedisConnection,
  setDiscordClient as setRedisDiscordClient,
} from '@/db/redis.js';
import { setDiscordClient as setDbDiscordClient } from '@/db/db.js';
import { loadActiveBans, loadActiveMutes } from '@/util/helpers.js';

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
        console.error(`Guild with ID ${config.guildId} not found.`);
        return;
      }

      const members = await guild.members.fetch();
      const nonBotMembers = members.filter((m) => !m.user.bot);
      await setMembers(nonBotMembers);

      await loadActiveBans(client, guild);
      await loadActiveMutes(client, guild);

      await scheduleFactOfTheDay(client);
      await scheduleGiveaways(client);

      console.log(`Ready! Logged in as ${client.user?.tag}`);
    } catch (error) {
      console.error('Failed to initialize the bot:', error);
    }
  },
} as Event<typeof Events.ClientReady>;
