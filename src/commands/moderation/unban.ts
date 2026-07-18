import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import type { OptionsCommand } from '@/types/CommandTypes.js';
import {
  executeUnban,
  safelyRespond,
  validateInteraction,
} from '@/util/helpers.js';
import { logger } from '@/util/logger.js';

const command: OptionsCommand = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption((option) =>
      option
        .setName('userid')
        .setDescription('The Discord ID of the user to unban')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('The reason for the unban')
        .setRequired(true)
    ),
  execute: async (interaction) => {
    if (!(await validateInteraction(interaction))) {
      await safelyRespond(
        interaction,
        'Invalid interaction. Please try again.',
        true
      );
      return;
    }

    await interaction.deferReply({ flags: ['Ephemeral'] });

    try {
      if (!interaction.guild) {
        await safelyRespond(
          interaction,
          'This command can only be used in a server (guild).',
          true
        );
        return;
      }
      const userId = interaction.options.get('userid')?.value as string;
      const reason = interaction.options.get('reason')?.value as string;

      try {
        const ban = await interaction.guild.bans.fetch(userId);
        if (!ban) {
          await safelyRespond(interaction, 'This user is not banned.');
          return;
        }
      } catch {
        await safelyRespond(
          interaction,
          'Error getting ban. Is this user banned?'
        );
        return;
      }

      await executeUnban(
        interaction.client,
        interaction.guild.id,
        userId,
        reason
      );

      await safelyRespond(
        interaction,
        `<@${userId}> has been unbanned. Reason: ${reason}`
      );
    } catch (error) {
      logger.error('[UnbanCommand] Error executing unban command', error);
      await safelyRespond(interaction, 'Unable to unban user.');
    }
  },
};

export default command;
