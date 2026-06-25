import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import type { OptionsCommand } from '@/types/CommandTypes.js';
import {
  executeUnmute,
  safelyRespond,
  validateInteraction,
} from '@/util/helpers.js';
import { logger } from '@/util/logger.js';

const command: OptionsCommand = {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Remove a timeout from a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) =>
      option
        .setName('member')
        .setDescription('The member to unmute')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('The reason for removing the timeout')
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

    const { guild } = interaction;

    if (!guild) {
      await safelyRespond(
        interaction,
        'This command can only be used in a server (guild).',
        true
      );
      return;
    }

    try {
      const moderator = await guild.members.fetch(interaction.user.id);
      const memberUser = interaction.options.getUser('member', true);
      const member = await guild.members.fetch(memberUser.id);
      const reason = interaction.options.getString('reason', true);

      await executeUnmute(
        interaction.client,
        guild.id,
        member.id,
        reason,
        moderator
      );

      await safelyRespond(
        interaction,
        `<@${member.id}>'s timeout has been removed. Reason: ${reason}`
      );
    } catch (error) {
      logger.error('[UnmuteCommand] Error executing unmute command', error);
      await safelyRespond(interaction, 'Unable to unmute member.');
    }
  },
};

export default command;
