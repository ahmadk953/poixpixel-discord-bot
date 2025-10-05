import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import { updateMemberModerationHistory } from '@/db/db.js';
import type { OptionsCommand } from '@/types/CommandTypes.js';
import logAction from '@/util/logging/logAction.js';
import { logger } from '@/util/logger.js';

const command: OptionsCommand = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) =>
      option
        .setName('member')
        .setDescription('The member to warn')
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('The reason for the warning')
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

      if (moderator.roles.highest.position <= member.roles.highest.position) {
        await interaction.editReply({
          content:
            'You cannot warn a member with equal or higher role than yours.',
        });
        return;
      }

      await updateMemberModerationHistory({
        discordId: member.user.id,
        moderatorDiscordId: interaction.user.id,
        action: 'warning',
        reason,
        duration: '',
      });

      await member.user.send(
        `You have been warned in **${guild.name}**. Reason: **${reason}**.`,
      );

      await logAction({
        guild,
        action: 'warn',
        target: member,
        moderator,
        reason,
      });

      await interaction.editReply(
        `<@${member.user.id}> has been warned. Reason: ${reason}`,
      );
    } catch (error) {
      logger.error('[WarnCommand] Error executing warn command', error);
      await interaction.editReply({
        content: 'There was an error trying to warn the member.',
      });
    }
  },
};

export default command;
