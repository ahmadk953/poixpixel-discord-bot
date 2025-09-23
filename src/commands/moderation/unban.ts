import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import { executeUnban } from '@/util/helpers.js';
import { OptionsCommand } from '@/types/CommandTypes.js';

const command: OptionsCommand = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
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
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    await interaction.deferReply({ flags: ['Ephemeral'] });

    try {
      const userId = interaction.options.get('userid')?.value as string;
      const reason = interaction.options.get('reason')?.value as string;

      try {
        const ban = await interaction.guild.bans.fetch(userId);
        if (!ban) {
          await interaction.editReply({
            content: 'This user is not banned.',
          });
          return;
        }
      } catch {
        await interaction.editReply({
          content: 'Error getting ban. Is this user banned?',
        });
        return;
      }

      await executeUnban(
        interaction.client,
        interaction.guild.id,
        userId,
        reason,
      );

      await interaction.editReply({
        content: `<@${userId}> has been unbanned. Reason: ${reason}`,
      });
    } catch (error) {
      console.error(`Unable to unban user: ${error}`);
      await interaction.editReply({
        content: 'Unable to unban user.',
      });
    }
  },
};

export default command;
