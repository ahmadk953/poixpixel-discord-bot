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
    const moderator = await interaction.guild?.members.fetch(
      interaction.user.id,
    );
    const member = await interaction.guild?.members.fetch(
      interaction.options.get('member')!.value as string,
    );
    const reason = interaction.options.get('reason')?.value as string;

    if (
      !interaction.memberPermissions?.has(
        PermissionsBitField.Flags.ModerateMembers,
      )
    ) {
      await interaction.reply({
        content: 'You do not have permission to unmute members.',
        flags: ['Ephemeral'],
      });
      return;
    }

    try {
      await executeUnmute(
        interaction.client,
        interaction.guild!.id,
        member!.id,
        reason,
        moderator,
      );

      await interaction.reply({
        content: `<@${member!.id}>'s timeout has been removed. Reason: ${reason}`,
      });
    } catch (error) {
      console.error('Unmute command error:', error);
      await interaction.reply({
        content: 'Unable to unmute member.',
        flags: ['Ephemeral'],
      });
    }
  },
};

export default command;
