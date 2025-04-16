import { PermissionsBitField, SlashCommandBuilder } from 'discord.js';

import { Command } from '@/types/CommandTypes.js';
import { recalculateUserLevels } from '@/util/levelingSystem.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('recalculatelevels')
    .setDescription('(Admin Only) Recalculate all user levels'),
  execute: async (interaction) => {
    if (
      !interaction.memberPermissions?.has(
        PermissionsBitField.Flags.Administrator,
      )
    ) {
      await interaction.reply({
        content: 'You do not have permission to use this command.',
        flags: ['Ephemeral'],
      });
      return;
    }

    await interaction.deferReply();
    await interaction.editReply('Recalculating levels...');

    try {
      await recalculateUserLevels();
      await interaction.editReply('Levels recalculated successfully!');
    } catch (error) {
      console.error('Error recalculating levels:', error);
      await interaction.editReply('Failed to recalculate levels.');
    }
  },
};

export default command;
