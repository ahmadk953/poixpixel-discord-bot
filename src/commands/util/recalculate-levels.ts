import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import type { Command } from '@/types/CommandTypes.js';
import { safelyRespond, validateInteraction } from '@/util/helpers.js';
import { recalculateUserLevels } from '@/util/levelingSystem.js';
import { logger } from '@/util/logger.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('recalculate-levels')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDescription('(Admin Only) Recalculate all user levels'),
  execute: async (interaction) => {
    if (!(await validateInteraction(interaction))) {
      await safelyRespond(
        interaction,
        'Invalid Interaction. Please try again.',
        true
      );
      return;
    }

    await interaction.deferReply({ flags: ['Ephemeral'] });
    await safelyRespond(interaction, 'Recalculating levels...');

    try {
      await recalculateUserLevels();
      await safelyRespond(interaction, 'Levels recalculated successfully!');
    } catch (error) {
      logger.error(
        '[RecalculateLevelsCommand] Error executing recalculate levels command',
        error
      );
      await safelyRespond(interaction, 'Failed to recalculate levels.');
    }
  },
};

export default command;
