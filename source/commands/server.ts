import { SlashCommandBuilder, CommandInteraction } from "discord.js";

interface Command {
  data: Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">;
  execute: (interaction: CommandInteraction) => Promise<void>;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("server")
    .setDescription("Provides information about the server."),
  execute: async (interaction) => {
    await interaction.reply(
      `The server name is ${interaction?.guild?.name} and it has ${interaction?.guild?.memberCount} members.`
    );
  },
};

export default command;
