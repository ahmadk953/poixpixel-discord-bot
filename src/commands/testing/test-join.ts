import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import type { Command } from '@/types/CommandTypes.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('test-join')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDescription('Simulates a new member joining'),

  execute: async (interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    const {guild} = interaction;

    await interaction.deferReply({ flags: ['Ephemeral'] });

    const fakeMember = await guild.members.fetch(interaction.user.id);
    guild.client.emit('guildMemberAdd', fakeMember);

    await interaction.editReply({
      content: 'Triggered the join event!',
    });
  },
};

export default command;
