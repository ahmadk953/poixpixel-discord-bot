import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import type { Command } from '@/types/CommandTypes.js';
import { safelyRespond, validateInteraction } from '@/util/helpers.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('test-join')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDescription('Simulates a new member joining'),

  execute: async (interaction) => {
    if (!(await validateInteraction(interaction))) {
      await safelyRespond(
        interaction,
        'Invalid interaction. Please try again.',
        true
      );
      return;
    }
    const { guild } = interaction;

    if (!guild) {
      await safelyRespond(
        interaction,
        'This command can only be used in a server (guild).',
        true
      );
      return;
    }

    await interaction.deferReply({ flags: ['Ephemeral'] });

    const fakeMember = await guild.members.fetch(interaction.user.id);
    guild.client.emit('guildMemberAdd', fakeMember);

    await safelyRespond(interaction, 'Triggered the join event!');
  },
};

export default command;
