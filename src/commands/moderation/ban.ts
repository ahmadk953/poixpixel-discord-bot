import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import { updateMember, updateMemberModerationHistory } from '@/db/db.js';
import { parseDuration, scheduleUnban } from '@/util/helpers.js';
import type { OptionsCommand } from '@/types/CommandTypes.js';
import { loadConfig } from '@/util/configLoader.js';
import logAction from '@/util/logging/logAction.js';
import { logger } from '@/util/logger.js';

const command: OptionsCommand = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((option) =>
      option
        .setName('member')
        .setDescription('The member to ban')
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('The reason for the ban')
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('duration')
        .setDescription(
          'The duration of the ban (ex. 5m, 1h, 1d, 1w). Leave blank for permanent ban.',
        )
        .setRequired(false),
    ),
  execute: async (interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    await interaction.deferReply({ flags: ['Ephemeral'] });

    try {
      const { guild } = interaction;
      const moderator = await guild.members.fetch(interaction.user.id);
      const targetUser = interaction.options.getUser('member', true);
      const member = await guild.members.fetch(targetUser.id);
      const reason = interaction.options.getString('reason', true);
      const banDuration =
        interaction.options.getString('duration') ?? undefined;

      if (moderator.roles.highest.position <= member.roles.highest.position) {
        await interaction.editReply({
          content:
            'You cannot ban a member with equal or higher role than yours.',
        });
        return;
      }

      if (!member.bannable) {
        await interaction.editReply({
          content: 'I do not have permission to ban this member.',
        });
        return;
      }

      const config = loadConfig();
      const invite = guild.vanityURLCode ?? config.serverInvite;
      const until = banDuration
        ? new Date(Date.now() + parseDuration(banDuration)).toUTCString()
        : 'indefinitely';

      try {
        await member.user.send(
          banDuration
            ? `You have been banned from ${guild.name} for ${banDuration}. Reason: ${reason}. You can join back at ${until} using the link below:\n${invite}`
            : `You been indefinitely banned from ${guild.name}. Reason: ${reason}.`,
        );
      } catch (error) {
        logger.error('[BanCommand] Failed to send DM to banned user', error);
      }
      await member.ban({ reason });

      if (banDuration) {
        const durationMs = parseDuration(banDuration);
        const expiresAt = new Date(Date.now() + durationMs);

        await scheduleUnban(interaction.client, guild.id, member.id, expiresAt);
      }

      await updateMemberModerationHistory({
        discordId: member.id,
        moderatorDiscordId: interaction.user.id,
        action: 'ban',
        reason,
        duration: banDuration ?? 'indefinite',
        createdAt: new Date(),
        active: true,
      });

      await updateMember({
        discordId: member.id,
        currentlyBanned: true,
      });

      await logAction({
        guild,
        action: 'ban',
        target: member,
        moderator,
        reason,
      });

      await interaction.editReply({
        content: banDuration
          ? `<@${member.id}> has been banned for ${banDuration}. Reason: ${reason}`
          : `<@${member.id}> has been indefinitely banned. Reason: ${reason}`,
      });
    } catch (error) {
      logger.error('[BanCommand] Error executing ban command', error);
      await interaction.editReply({
        content: 'Unable to ban member.',
      });
    }
  },
};

export default command;
