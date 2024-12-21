import { SlashCommandBuilder, CommandInteraction } from 'discord.js';

interface Command {
  data: Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;
  execute: (interaction: CommandInteraction) => Promise<void>;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('server')
    .setDescription('Provides information about the server.'),
  execute: async (interaction) => {
    await interaction.reply(
      `The server ${interaction!.guild!.name} has ${interaction!.guild!.memberCount} members and was created on ${interaction!.guild!.createdAt}. It is ${new Date().getFullYear() - interaction!.guild!.createdAt.getFullYear()!} years old.`,
    );
  },
};

export default command;
