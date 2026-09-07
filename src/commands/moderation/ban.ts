import {
  type GuildMember,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';

import { updateMember, updateMemberModerationHistory } from '@/db/db.js';
import type { OptionsCommand } from '@/types/CommandTypes.js';
import { loadConfig } from '@/util/configLoader.js';
import {
  parseDuration,
  safelyRespond,
  scheduleUnban,
  validateInteraction,
} from '@/util/helpers.js';
import { logger } from '@/util/logger.js';
import logAction from '@/util/logging/logAction.js';

const command: OptionsCommand = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((option) =>
      option
        .setName('member')
        .setDescription('The member to ban')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('The reason for the ban')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('duration')
        .setDescription(
          'The duration of the ban (ex. 5m, 1h, 1d, 1w). Leave blank for permanent ban.'
        )
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
        await safelyRespond(interaction, 'Guild not found.', true);
        return;
      }

      const moderator = await guild.members.fetch(interaction.user.id);
      const targetUser = interaction.options.getUser('member');
      const targetId = targetUser?.id;

      if (!targetId) {
        await safelyRespond(interaction, 'Target user not found.', true);
        return;
      }

      const member = await guild.members.fetch(targetId).catch(() => null);
      const reason =
        interaction.options.getString('reason') ?? 'No reason provided';
      const banDuration =
        interaction.options.getString('duration') ?? undefined;

      const restrictionReason = getBanRestrictionReason(moderator, member);
      if (restrictionReason) {
        await safelyRespond(interaction, restrictionReason);
        return;
      }

      const config = loadConfig();
      const invite = guild.vanityURLCode ?? config.serverInvite;
      const until = banDuration
        ? new Date(Date.now() + parseDuration(banDuration)).toUTCString()
        : 'indefinitely';

      const userForDm =
        targetUser ??
        member?.user ??
        (await interaction.client.users.fetch(targetId).catch(() => null));

      try {
        await userForDm?.send(
          banDuration
            ? `You have been banned from ${guild.name} for ${banDuration}. Reason: ${reason}. You can join back at ${until} using the link below:\n${invite}`
            : `You been indefinitely banned from ${guild.name}. Reason: ${reason}.`
        );
      } catch (error) {
        logger.error('[BanCommand] Failed to send DM to banned user', error);
      }
      await guild.members.ban(targetId, { reason });

      if (banDuration) {
        const durationMs = parseDuration(banDuration);
        const expiresAt = new Date(Date.now() + durationMs);

        await scheduleUnban(interaction.client, guild.id, targetId, expiresAt);
      }

      await updateMemberModerationHistory({
        discordId: targetId,
        moderatorDiscordId: interaction.user.id,
        action: 'ban',
        reason,
        duration: banDuration ?? 'indefinite',
        createdAt: new Date(),
        active: true,
      });

      await updateMember({
        discordId: targetId,
        currentlyBanned: true,
      });

      await logAction({
        guild,
        action: 'ban',
        target: userForDm ?? { id: targetId },
        moderator,
        reason,
      });

      await safelyRespond(
        interaction,
        banDuration
          ? `<@${targetId}> has been banned for ${banDuration}. Reason: ${reason}`
          : `<@${targetId}> has been indefinitely banned. Reason: ${reason}`
      );
    } catch (error) {
      logger.error('[BanCommand] Error executing ban command', error);
      await safelyRespond(interaction, 'Unable to ban member.');
    }
  },
};

function getBanRestrictionReason(
  moderator: GuildMember,
  member: GuildMember | null
): string | null {
  if (!member) {
    return null;
  }

  if (moderator.roles.highest.position <= member.roles.highest.position) {
    return 'You cannot ban a member with equal or higher role than yours.';
  }

  if (!member.bannable) {
    return 'I do not have permission to ban this member.';
  }

  return null;
}

export default command;
