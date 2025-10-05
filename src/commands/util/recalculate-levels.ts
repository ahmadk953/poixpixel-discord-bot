import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import type { Command } from '@/types/CommandTypes.js';
import { recalculateUserLevels } from '@/util/levelingSystem.js';
import { logger } from '@/util/logger.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('recalculate-levels')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDescription('(Admin Only) Recalculate all user levels'),
  execute: async (interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    await interaction.deferReply({ flags: ['Ephemeral'] });
    await interaction.editReply('Recalculating levels...');

    try {
      await recalculateUserLevels();
      await interaction.editReply('Levels recalculated successfully!');
    } catch (error) {
      logger.error(
        '[RecalculateLevelsCommand] Error executing recalculate levels command',
        error,
      );
      await interaction.editReply('Failed to recalculate levels.');
    }
  },
};

export default command;
