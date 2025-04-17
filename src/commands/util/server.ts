import { SlashCommandBuilder } from 'discord.js';

import { Command } from '@/types/CommandTypes.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('server')
    .setDescription('Provides information about the server.'),
  execute: async (interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    await interaction.reply(
      `The server **${interaction.guild.name}** has **${interaction.guild.memberCount}** members and was created on **${interaction.guild.createdAt}**. It is **${new Date().getFullYear() - interaction.guild.createdAt.getFullYear()}** years old.`,
    );
  },
};

export default command;
