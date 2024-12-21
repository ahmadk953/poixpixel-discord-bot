import {
  SlashCommandBuilder,
  CommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { getAllMembers } from '../../util/db.js';

interface Command {
  data: Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;
  execute: (interaction: CommandInteraction) => Promise<void>;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('members')
    .setDescription('Lists all non-bot members of the server'),
  execute: async (interaction) => {
    const members = await getAllMembers();
    const memberList = members
      .map((m) => `**${m.discordUsername}** (${m.discordId})`)
      .join('\n');
    const membersEmbed = new EmbedBuilder()
      .setTitle('Members')
      .setDescription(memberList)
      .setColor(0x0099ff)
      .addFields({ name: 'Total Members', value: members.length.toString() });
    await interaction.reply({ embeds: [membersEmbed] });
  },
};

export default command;
