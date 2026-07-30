import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import { updateMemberModerationHistory } from '@/db/db.js';
import type { OptionsCommand } from '@/types/CommandTypes.js';
import { safelyRespond, validateInteraction } from '@/util/helpers.js';
import { logger } from '@/util/logger.js';
import logAction from '@/util/logging/logAction.js';

const command: OptionsCommand = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) =>
      option
        .setName('member')
        .setDescription('The member to warn')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('The reason for the warning')
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
      const reason =
        interaction.options.getString('reason') ?? 'No reason provided';

      if (moderator.roles.highest.position <= member.roles.highest.position) {
        await safelyRespond(
          interaction,
          'You cannot warn a member with equal or higher role than yours.'
        );
        return;
      }

      await updateMemberModerationHistory({
        discordId: member.user.id,
        moderatorDiscordId: interaction.user.id,
        action: 'warning',
        reason,
        duration: '',
      });

      try {
        await member.user.send(
          `You have been warned in **${guild.name}**. Reason: **${reason}**.`
        );
      } catch (error) {
        logger.warn('[WarnCommand] Failed to DM user', error);
      }

      await logAction({
        guild,
        action: 'warn',
        target: member,
        moderator,
        reason,
      });

      await safelyRespond(
        interaction,
        `<@${member.user.id}> has been warned. Reason: ${reason}`
      );
    } catch (error) {
      logger.error('[WarnCommand] Error executing warn command', error);
      await safelyRespond(
        interaction,
        'There was an error trying to warn the member.'
      );
    }
  },
};

export default command;
