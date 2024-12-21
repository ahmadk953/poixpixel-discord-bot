import {
  SlashCommandBuilder,
  CommandInteraction,
  EmbedBuilder,
  SlashCommandOptionsOnlyBuilder,
} from 'discord.js';
import { getMember } from '../../util/db.js';

interface Command {
  data: SlashCommandOptionsOnlyBuilder;
  execute: (interaction: CommandInteraction) => Promise<void>;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Provides information about the user.')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('The user whose information you want to retrieve.')
        .setRequired(true)
    ),
  execute: async (interaction) => {
    const userOption = interaction.options.get('user');
    if (!userOption) {
      await interaction.reply('User not found');
      return;
    }
    const user = userOption.user;
    if (!user) {
      await interaction.reply('User not found');
      return;
    }
    const member = await getMember(user.id);
    const [memberData] = member;
    const embed = new EmbedBuilder()
      .setTitle(`User Information - ${user?.username}`)
      .setColor(user.accentColor || 'Default')
      .addFields(
        { name: 'Username', value: user.username, inline: false },
        { name: 'User ID', value: user.id, inline: false },
        {
          name: 'Joined Server',
          value:
            interaction.guild?.members.cache
              .get(user.id)
              ?.joinedAt?.toLocaleString() || 'Not available',
          inline: false,
        },
        {
          name: 'Account Created',
          value: user.createdAt.toLocaleString(),
          inline: false,
        },
        {
          name: 'Number of Warnings',
          value: memberData?.numberOfWarnings.toString() || '0',
        },
        {
          name: 'Number of Bans',
          value: memberData?.numberOfBans.toString() || '0',
        }
      );
    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
