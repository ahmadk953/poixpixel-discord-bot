import { Client, Events } from 'discord.js';

import { ensureDbInitialized, setMembers } from '../db/db.js';
import { loadConfig } from '../util/configLoader.js';
import { Event } from '../types/EventTypes.js';
import { scheduleFactOfTheDay } from '../util/factManager.js';

import {
  ensureRedisConnection,
  setDiscordClient as setRedisDiscordClient,
} from '../db/redis.js';
import { setDiscordClient as setDbDiscordClient } from '../db/db.js';

export default {
  name: Events.ClientReady,
  once: true,
  execute: async (client: Client) => {
    const config = loadConfig();
    try {
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

      await scheduleFactOfTheDay(client);
    } catch (error) {
      console.error('Failed to initialize the bot:', error);
    }

    console.log(`Ready! Logged in as ${client.user?.tag}`);
  },
} as Event<typeof Events.ClientReady>;
