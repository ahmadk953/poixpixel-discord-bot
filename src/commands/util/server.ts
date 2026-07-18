import { SlashCommandBuilder } from 'discord.js';

import type { Command } from '@/types/CommandTypes.js';
import { safelyRespond, validateInteraction } from '@/util/helpers.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('server')
    .setDescription('Provides information about the server.'),
  execute: async (interaction) => {
    if (!(await validateInteraction(interaction))) {
      await safelyRespond(
        interaction,
        'Invalid interaction. Please try again.',
        true
      );
      return;
    }

    if (!interaction.guild) {
      await safelyRespond(
        interaction,
        'This command can only be used in a server (guild).',
        true
      );
      return;
    }

    await safelyRespond(
      interaction,
      `The server **${interaction.guild.name}** has **${interaction.guild.memberCount}** members and was created on **${interaction.guild.createdAt}**. It is **${new Date().getFullYear() - interaction.guild.createdAt.getFullYear()}** years old.`
    );
  },
};

export default command;
