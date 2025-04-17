import { SlashCommandBuilder } from 'discord.js';

import { Command } from '@/types/CommandTypes.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the latency from you to the bot'),
  execute: async (interaction) => {
    await interaction.reply(
      `🏓 Pong! Latency: ${Date.now() - interaction.createdTimestamp}ms`,
    );
  },
};

export default command;
