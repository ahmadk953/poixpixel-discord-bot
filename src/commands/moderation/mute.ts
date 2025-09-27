import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import { updateMember, updateMemberModerationHistory } from '@/db/db.js';
import { parseDuration } from '@/util/helpers.js';
import { OptionsCommand } from '@/types/CommandTypes.js';
import logAction from '@/util/logging/logAction.js';

const command: OptionsCommand = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Timeout a member in the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers)
    .addUserOption((option) =>
      option
        .setName('member')
        .setDescription('The member to timeout')
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('The reason for the timeout')
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('duration')
        .setDescription(
          'The duration of the timeout (ex. 5m, 1h, 1d, 1w). Max 28 days.',
        )
        .setRequired(true),
    ),
  execute: async (interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    await interaction.deferReply({ flags: ['Ephemeral'] });

    try {
      const moderator = await interaction.guild.members.fetch(
        interaction.user.id,
      );
      const member = await interaction.guild.members.fetch(
        interaction.options.get('member')!.value as string,
      );
      const reason = interaction.options.get('reason')?.value as string;
      const muteDuration = interaction.options.get('duration')?.value as string;

      if (moderator.roles.highest.position <= member.roles.highest.position) {
        await interaction.editReply({
          content:
            'You cannot mute a member with equal or higher role than yours.',
        });
        return;
      }

      if (!member.moderatable) {
        await interaction.editReply({
          content: 'I do not have permission to mute this member.',
        });
        return;
      }

      const durationMs = parseDuration(muteDuration);
      const maxTimeout = 28 * 24 * 60 * 60 * 1000;

      if (durationMs > maxTimeout) {
        await interaction.editReply({
          content: 'Timeout duration cannot exceed 28 days.',
        });
        return;
      }

      await member.user.send(
        `You have been timed out in ${interaction.guild!.name} for ${muteDuration}. Reason: ${reason}.`,
      );

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
        guild: interaction.guild!,
        action: 'mute',
        target: member,
        moderator,
        reason,
        duration: muteDuration,
      });

      await interaction.editReply({
        content: `<@${member.id}> has been muted for ${muteDuration}. Reason: ${reason}`,
      });
    } catch (error) {
      console.error('Mute command error:', error);
      await interaction.editReply({
        content: 'Unable to timeout member.',
      });
    }
  },
};

export default command;
