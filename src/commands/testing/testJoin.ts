import { PermissionsBitField, SlashCommandBuilder } from 'discord.js';

import { Command } from '@/types/CommandTypes.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('testjoin')
    .setDescription('Simulates a new member joining'),

  execute: async (interaction) => {
    const guild = interaction.guild;

    if (
      !interaction.memberPermissions!.has(
        PermissionsBitField.Flags.Administrator,
      )
    ) {
      await interaction.reply({
        content: 'You do not have permission to use this command.',
        flags: ['Ephemeral'],
      });
    }

    const fakeMember = await guild!.members.fetch(interaction.user.id);
    guild!.client.emit('guildMemberAdd', fakeMember);

    await interaction.reply({
      content: 'Triggered the join event!',
      flags: ['Ephemeral'],
    });
  },
};

export default command;
