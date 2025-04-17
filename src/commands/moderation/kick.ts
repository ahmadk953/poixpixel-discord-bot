import { PermissionsBitField, SlashCommandBuilder } from 'discord.js';

import { updateMemberModerationHistory } from '@/db/db.js';
import { OptionsCommand } from '@/types/CommandTypes.js';
import { loadConfig } from '@/util/configLoader.js';
import logAction from '@/util/logging/logAction.js';

const command: OptionsCommand = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server')
    .addUserOption((option) =>
      option
        .setName('member')
        .setDescription('The member to kick')
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('The reason for the kick')
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

      if (
        !interaction.memberPermissions?.has(
          PermissionsBitField.Flags.KickMembers,
        )
      ) {
        await interaction.editReply({
          content: 'You do not have permission to kick members.',
        });
        return;
      }

      if (moderator!.roles.highest.position <= member.roles.highest.position) {
        await interaction.editReply({
          content:
            'You cannot kick a member with equal or higher role than yours.',
        });
        return;
      }

      if (!member.kickable) {
        await interaction.editReply({
          content: 'I do not have permission to kick this member.',
        });
        return;
      }

      try {
        await member.user.send(
          `You have been kicked from ${interaction.guild!.name}. Reason: ${reason}. You can join back at: \n${interaction.guild.vanityURLCode ?? loadConfig().serverInvite}`,
        );
      } catch (error) {
        console.error('Failed to send DM to kicked user:', error);
      }

      await member.kick(reason);

      await updateMemberModerationHistory({
        discordId: member.id,
        moderatorDiscordId: interaction.user.id,
        action: 'kick',
        reason,
        duration: '',
        createdAt: new Date(),
      });

      await logAction({
        guild: interaction.guild!,
        action: 'kick',
        target: member,
        moderator,
        reason,
      });

      await interaction.editReply({
        content: `<@${member.id}> has been kicked. Reason: ${reason}`,
      });
    } catch (error) {
      console.error('Kick command error:', error);
      await interaction.editReply({
        content: 'Unable to kick member.',
      });
    }
  },
};

export default command;
