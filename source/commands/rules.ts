import {
  SlashCommandBuilder,
  CommandInteraction,
  EmbedBuilder,
  CommandInteractionOptionResolver ,
} from "discord.js";

interface Command {
  data: Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">;
  execute: (interaction: CommandInteraction) => Promise<void>;
}

const rulesEmbed = new EmbedBuilder()
  .setColor(0x0099ff)
  .setTitle("Server Rules")
  .setAuthor({
    name: "Poixixel",
    iconURL:
      "https://cdn.discordapp.com/avatars/1052017329376071781/922947c726d7866d313744186c42ef49.webp",
  })
  .setDescription(
    "These are the rules for the server. Please read and follow them carefully."
  )
  .addFields(
    {
      name: "Rule #1: Be respectful",
      value:
        "This means no mean, rude, or harassing comments. Treat others the way you want to be treated.",
    },
    {
      name: "Rule #2: No inappropriate language",
      value:
        "All profanity language is prohibited in this server. Any derogatory language towards any user is prohibited. Swearing is not permitted in any channels.",
    },
    { name: "\u200B", value: "\u200B" }
    //TODO Add all the rest of Poixpixel's rules here
  )
  .setTimestamp()
  .setFooter({
    text: "Sent by the Poixpixel Bot",
    iconURL:
      "https://cdn.discordapp.com/avatars/1052017329376071781/922947c726d7866d313744186c42ef49.webp",
  });

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("rules")
    .setDescription("Sends the server rules"),
  execute: async (interaction) => {
    const channel = interaction.channel;
    channel?.send({ embeds: [rulesEmbed] });
    await interaction.reply({ content: 'The Rules Were Sent in the Current Channel', ephemeral: true });
  },
};

export default command;
