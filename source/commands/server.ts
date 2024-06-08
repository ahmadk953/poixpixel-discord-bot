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
      /* @ts-ignore */
      `The server name is ${interaction?.guild?.name} and it has ${interaction?.guild?.memberCount} members. It was created on ${interaction?.guild?.createdAt} and is ${interaction?.guild?.createdAt?.getFullYear() - 2024} years old.`
    );
  },
};

export default command;
