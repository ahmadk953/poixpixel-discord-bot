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
    .addUserOption((option) =>
      option
        .setName('member')
        .setDescription('The member to unban')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('The reason for the unban')
        .setRequired(false)
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
      const targetUser = interaction.options.getUser('member');
      const userId = targetUser?.id;
      const reason =
        (interaction.options.get('reason')?.value as string) ??
        'No reason provided';

      if (!userId) {
        await safelyRespond(interaction, 'Target user not found.', true);
        return;
      }

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
        interaction.user.id,
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
