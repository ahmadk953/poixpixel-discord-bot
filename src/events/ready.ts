import { Client, Events } from 'discord.js';

import { setMembers } from '../db/db.js';
import { loadConfig } from '../util/configLoader.js';

export default {
  name: Events.ClientReady,
  once: true,
  execute: async (client: Client) => {
    const config = loadConfig();
    const members = await client.guilds.cache
      .find((guild) => guild.id === config.guildId)
      ?.members.fetch();
    const nonBotMembers = members!.filter((m) => !m.user.bot);
    await setMembers(nonBotMembers);

    console.log(`Ready! Logged in as ${client.user?.tag}`);
  },
};
