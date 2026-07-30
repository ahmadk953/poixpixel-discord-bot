import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import { updateMember, updateMemberModerationHistory } from '@/db/db.js';
import type { OptionsCommand } from '@/types/CommandTypes.js';
import {
  parseDuration,
  safelyRespond,
  validateInteraction,
} from '@/util/helpers.js';
import { logger } from '@/util/logger.js';
import logAction from '@/util/logging/logAction.js';

const command: OptionsCommand = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Timeout a member in the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) =>
      option
        .setName('member')
        .setDescription('The member to timeout')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('duration')
        .setDescription(
          'The duration of the timeout (ex. 5m, 1h, 1d, 1w). Max 28 days.'
        )
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('The reason for the timeout')
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
      const { guild } = interaction;

      if (!guild) {
        await safelyRespond(
          interaction,
          'This command can only be used in a server (guild).',
          true
        );
        return;
      }
      const moderator = await guild.members.fetch(interaction.user.id);
      const targetUser = interaction.options.getUser('member', true);
      const member = await guild.members.fetch(targetUser.id);
      const reason =
        interaction.options.getString('reason') ?? 'No reason provided';
      const muteDuration = interaction.options.getString('duration', true);

      if (moderator.roles.highest.position <= member.roles.highest.position) {
        await safelyRespond(
          interaction,
          'You cannot mute a member with equal or higher role than yours.'
        );
        return;
      }

      if (!member.moderatable) {
        await safelyRespond(
          interaction,
          'I do not have permission to mute this member.'
        );
        return;
      }

      const durationMs = parseDuration(muteDuration);
      const maxTimeout = 28 * 24 * 60 * 60 * 1000;

      if (durationMs > maxTimeout) {
        await safelyRespond(
          interaction,
          'Timeout duration cannot exceed 28 days.'
        );
        return;
      }

      try {
        await member.user.send(
          `You have been timed out in ${guild.name} for ${muteDuration}. Reason: ${reason}.`
        );
      } catch (error) {
        logger.warn(
          `[MuteCommand] Failed to DM user ${member.id.slice(-4)} before applying timeout`,
          error
        );
      }

      await member.timeout(durationMs, reason);

      const expiresAt = new Date(Date.now() + durationMs);

      await updateMemberModerationHistory({
        discordId: member.id,
        moderatorDiscordId: interaction.user.id,
        action: 'mute',
        reason,
        duration: muteDuration,
        createdAt: new Date(),
        expiresAt,
        active: true,
      });

      await updateMember({
        discordId: member.id,
        currentlyMuted: true,
      });

      await logAction({
        guild,
        action: 'mute',
        target: member,
        moderator,
        reason,
        duration: muteDuration,
      });

      await safelyRespond(
        interaction,
        `<@${member.id}> has been muted for ${muteDuration}. Reason: ${reason}`
      );
    } catch (error) {
      logger.error('[MuteCommand] Error executing mute command', error);
      await safelyRespond(interaction, 'Unable to timeout member.');
    }
  },
};

export default command;
