import { PermissionsBitField, SlashCommandBuilder } from 'discord.js';

import { updateMember, updateMemberModerationHistory } from '../../db/db.js';
import { parseDuration, scheduleUnban } from '../../util/helpers.js';
import { OptionsCommand } from '../../types/CommandTypes.js';
import logAction from '../../util/logging/logAction.js';

const command: OptionsCommand = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server')
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
    const moderator = await interaction.guild?.members.fetch(
      interaction.user.id,
    );
    const member = await interaction.guild?.members.fetch(
      interaction.options.get('member')!.value as string,
    );
    const reason = interaction.options.get('reason')?.value as string;
    const banDuration = interaction.options.get('duration')?.value as
      | string
      | undefined;

    if (
      !interaction.memberPermissions?.has(
        PermissionsBitField.Flags.BanMembers,
      ) ||
      moderator!.roles.highest.position <= member!.roles.highest.position ||
      !member?.bannable
    ) {
      await interaction.reply({
        content:
          'You do not have permission to ban members or this member cannot be banned.',
        flags: ['Ephemeral'],
      });
      return;
    }

    try {
      await member.user.send(
        banDuration
          ? `You have been banned from ${interaction.guild!.name} for ${banDuration}. Reason: ${reason}. You can join back at ${new Date(
              Date.now() + parseDuration(banDuration),
            ).toUTCString()} using the link below:\nhttps://discord.gg/KRTGjxx7gY`
          : `You been indefinitely banned from ${interaction.guild!.name}. Reason: ${reason}.`,
      );
      await member.ban({ reason });

      if (banDuration) {
        const durationMs = parseDuration(banDuration);
        const expiresAt = new Date(Date.now() + durationMs);

        await scheduleUnban(
          interaction.client,
          interaction.guild!.id,
          member.id,
          expiresAt,
        );
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
        guild: interaction.guild!,
        action: 'ban',
        target: member,
        moderator: moderator!,
        reason,
      });

      await interaction.reply({
        content: banDuration
          ? `<@${member.id}> has been banned for ${banDuration}. Reason: ${reason}`
          : `<@${member.id}> has been indefinitely banned. Reason: ${reason}`,
      });
    } catch (error) {
      console.error('Ban command error:', error);
      await interaction.reply({
        content: 'Unable to ban member.',
        flags: ['Ephemeral'],
      });
    }
  },
};

export default command;
