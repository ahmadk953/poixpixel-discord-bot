import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import { executeUnmute } from '@/util/helpers.js';
import type { OptionsCommand } from '@/types/CommandTypes.js';
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
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('The reason for removing the timeout')
        .setRequired(true),
    ),
  execute: async (interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    await interaction.deferReply({ flags: ['Ephemeral'] });

    const { guild } = interaction;

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
        moderator,
      );

      await interaction.editReply({
        content: `<@${member.id}>'s timeout has been removed. Reason: ${reason}`,
      });
    } catch (error) {
      logger.error('[UnmuteCommand] Error executing unmute command', error);
      await interaction.editReply({
        content: 'Unable to unmute member.',
      });
    }
  },
};

export default command;
