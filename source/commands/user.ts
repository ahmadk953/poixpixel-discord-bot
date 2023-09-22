import { SlashCommandBuilder } from 'discord.js';

interface Command {
	data: SlashCommandBuilder;
	execute: (interaction: any) => Promise<void>;
}

export const command: Command = {
	data: new SlashCommandBuilder().setName('user').setDescription('Provides information about the user.'),
	execute: async (interaction) => {
		await interaction.reply(`This command was run by ${interaction.user.username}, who joined on ${interaction.member.joinedAt}.`);
	},
};
