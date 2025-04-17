import { PermissionsBitField, SlashCommandBuilder } from 'discord.js';

import { executeUnmute } from '@/util/helpers.js';
import { OptionsCommand } from '@/types/CommandTypes.js';

const command: OptionsCommand = {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Remove a timeout from a member')
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
          PermissionsBitField.Flags.ModerateMembers,
        )
      ) {
        await interaction.editReply({
          content: 'You do not have permission to unmute members.',
        });
        return;
      }
      await executeUnmute(
        interaction.client,
        interaction.guild.id,
        member.id,
        reason,
        moderator,
      );

      await interaction.editReply({
        content: `<@${member.id}>'s timeout has been removed. Reason: ${reason}`,
      });
    } catch (error) {
      console.error('Unmute command error:', error);
      await interaction.editReply({
        content: 'Unable to unmute member.',
      });
    }
  },
};

export default command;
