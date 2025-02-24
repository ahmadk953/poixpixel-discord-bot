import {
  CommandInteraction,
  PermissionsBitField,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
} from 'discord.js';
import { updateMember } from '../../db/db.js';

interface Command {
  data: SlashCommandOptionsOnlyBuilder;
  execute: (interaction: CommandInteraction) => Promise<void>;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('testleave')
    .setDescription('Simulates a member leaving'),

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
    guild!.client.emit('guildMemberRemove', fakeMember);

    await interaction.reply({
      content: 'Triggered the leave event!',
      flags: ['Ephemeral'],
    });

    await updateMember({
      discordId: interaction.user.id,
      currentlyInServer: true,
    });
  },
};

export default command;
