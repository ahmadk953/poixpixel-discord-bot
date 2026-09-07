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

    try {
      const result = await recalculateUserLevels();

      let message = 'Levels recalculated successfully!';

      if (result.totalUsers > 0) {
        const stats = [
          `${result.totalUsers.toLocaleString()} users processed`,
          `${result.updated.toLocaleString()} levels updated`,
        ];

        if (result.leveledUp > 0) {
          stats.push(`${result.leveledUp.toLocaleString()} leveled up`);
        }
        if (result.levelDown > 0) {
          stats.push(
            `${result.levelDown.toLocaleString()} levels adjusted down`
          );
        }

        message = `${message}\n\n**Stats:** ${stats.join(' | ')}`;
      }

      await interaction.editReply({ content: message });
    } catch (error) {
      logger.error(
        '[RecalculateLevelsCommand] Error executing recalculate levels command',
        error
      );
      await interaction.editReply({
        content: 'Failed to recalculate levels.',
      });
    }
  },
};

export default command;
