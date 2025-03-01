import { Client, Events } from 'discord.js';

import { setMembers } from '../db/db.js';
import { loadConfig } from '../util/configLoader.js';
import { Event } from '../types/EventTypes.js';

export default {
  name: Events.ClientReady,
  once: true,
  execute: async (client: Client) => {
    const config = loadConfig();
    try {
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
    } catch (error) {
      console.error('Failed to initialize members in database:', error);
    }

    console.log(`Ready! Logged in as ${client.user?.tag}`);
  },
} as Event<typeof Events.ClientReady>;
