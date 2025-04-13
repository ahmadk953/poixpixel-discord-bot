import { PermissionsBitField, SlashCommandBuilder } from 'discord.js';

import { executeUnban } from '@/util/helpers.js';
import { OptionsCommand } from '@/types/CommandTypes.js';

const command: OptionsCommand = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user from the server')
    .addStringOption((option) =>
      option
        .setName('userid')
        .setDescription('The Discord ID of the user to unban')
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('The reason for the unban')
        .setRequired(true),
    ),
  execute: async (interaction) => {
    const userId = interaction.options.get('userid')!.value as string;
    const reason = interaction.options.get('reason')?.value as string;

    if (
      !interaction.memberPermissions?.has(PermissionsBitField.Flags.BanMembers)
    ) {
      await interaction.reply({
        content: 'You do not have permission to unban users.',
        flags: ['Ephemeral'],
      });
      return;
    }

    try {
      try {
        const ban = await interaction.guild?.bans.fetch(userId);
        if (!ban) {
          await interaction.reply({
            content: 'This user is not banned.',
            flags: ['Ephemeral'],
          });
          return;
        }
      } catch {
        await interaction.reply({
          content: 'Error getting ban. Is this user banned?',
          flags: ['Ephemeral'],
        });
        return;
      }

      await executeUnban(
        interaction.client,
        interaction.guildId!,
        userId,
        reason,
      );

      await interaction.reply({
        content: `<@${userId}> has been unbanned. Reason: ${reason}`,
      });
    } catch (error) {
      console.error(error);
      await interaction.reply({
        content: 'Unable to unban user.',
        flags: ['Ephemeral'],
      });
    }
  },
};

export default command;
