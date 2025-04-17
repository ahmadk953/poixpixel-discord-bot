import { PermissionsBitField, SlashCommandBuilder } from 'discord.js';

import { updateMemberModerationHistory } from '@/db/db.js';
import { OptionsCommand } from '@/types/CommandTypes.js';
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
    const moderator = await interaction.guild?.members.fetch(
      interaction.user.id,
    );
    const member = await interaction.guild?.members.fetch(
      interaction.options.get('member')!.value as string,
    );
    const reason = interaction.options.get('reason')?.value as string;

    if (
      !interaction.memberPermissions?.has(
        PermissionsBitField.Flags.KickMembers,
      ) ||
      moderator!.roles.highest.position <= member!.roles.highest.position ||
      !member?.kickable
    ) {
      await interaction.reply({
        content:
          'You do not have permission to kick members or this member cannot be kicked.',
        flags: ['Ephemeral'],
      });
      return;
    }

    try {
      try {
        await member.user.send(
          `You have been kicked from ${interaction.guild!.name}. Reason: ${reason}. You can join back at: \nhttps://discord.gg/KRTGjxx7gY`,
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
        moderator: moderator!,
        reason,
      });

      await interaction.reply({
        content: `<@${member.id}> has been kicked. Reason: ${reason}`,
      });
    } catch (error) {
      console.error('Kick command error:', error);
      await interaction.reply({
        content: 'Unable to kick member.',
        flags: ['Ephemeral'],
      });
    }
  },
};

export default command;
