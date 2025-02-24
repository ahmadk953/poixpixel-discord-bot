import { Client, Events } from 'discord.js';

export default {
  name: Events.ClientReady,
  once: true,
  execute: async (client: Client) => {
    console.log(`Ready! Logged in as ${client.user?.tag}`);
  },
};
