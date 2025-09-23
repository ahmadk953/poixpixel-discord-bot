import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import { updateMember } from '@/db/db.js';
import { Command } from '@/types/CommandTypes.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('test-leave')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDescription('Simulates a member leaving'),

  execute: async (interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    const guild = interaction.guild;

    await interaction.deferReply({ flags: ['Ephemeral'] });

    const fakeMember = await guild.members.fetch(interaction.user.id);
    guild.client.emit('guildMemberRemove', fakeMember);

    await interaction.editReply({
      content: 'Triggered the leave event!',
    });

    await updateMember({
      discordId: interaction.user.id,
      currentlyInServer: true,
    });
  },
};

export default command;
