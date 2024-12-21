import { SlashCommandBuilder, CommandInteraction } from 'discord.js';

interface Command {
  data: Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;
  execute: (interaction: CommandInteraction) => Promise<void>;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the latency from you to the bot'),
  execute: async (interaction) => {
    await interaction.reply(`Pong! Latency: ${Date.now() - interaction.createdTimestamp}ms`);
  },
};

export default command;
