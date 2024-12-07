import {
  SlashCommandBuilder,
  CommandInteraction,
  GuildMember,
} from 'discord.js';

interface Command {
  data: Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;
  execute: (interaction: CommandInteraction) => Promise<void>;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('user')
    .setDescription('Provides information about the user.'),
  execute: async (interaction) => {
    if (interaction.member instanceof GuildMember) {
      await interaction.reply(
        `This command was run by ${interaction.user.username}, who joined this server on ${interaction.member.joinedAt}.`
      );
    }
    else {
      await interaction.reply(
        `This command was run by ${interaction.user.username}.`
      );
    }
  },
};

export default command;
