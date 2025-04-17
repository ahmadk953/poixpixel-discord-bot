import { PermissionsBitField, SlashCommandBuilder } from 'discord.js';

import { Command } from '@/types/CommandTypes.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('testjoin')
    .setDescription('Simulates a new member joining'),

  execute: async (interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    const guild = interaction.guild;

    await interaction.deferReply({ flags: ['Ephemeral'] });

    if (
      !interaction.memberPermissions!.has(
        PermissionsBitField.Flags.Administrator,
      )
    ) {
      await interaction.editReply({
        content: 'You do not have permission to use this command.',
      });
      return;
    }

    const fakeMember = await guild.members.fetch(interaction.user.id);
    guild.client.emit('guildMemberAdd', fakeMember);

    await interaction.editReply({
      content: 'Triggered the join event!',
    });
  },
};

export default command;
