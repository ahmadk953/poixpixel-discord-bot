import { SlashCommandBuilder } from 'discord.js';

interface Command {
	data: SlashCommandBuilder;
	execute: (interaction: any) => Promise<void>;
}

export const command: Command = {
	data: new SlashCommandBuilder().setName('server').setDescription('Provides information about the server.'),
	execute: async (interaction) => {
		await interaction.reply(`This server is ${interaction.guild.name} and has ${interaction.guild.memberCount} members.`);
	},
};
