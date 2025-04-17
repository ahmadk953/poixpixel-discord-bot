import { PermissionsBitField, SlashCommandBuilder } from 'discord.js';

import { updateMember } from '@/db/db.js';
import { Command } from '@/types/CommandTypes.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('testleave')
    .setDescription('Simulates a member leaving'),

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
    }

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
