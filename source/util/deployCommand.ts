import { REST, Routes } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';

export async function deployCommands({token, guildId, clientId}: any) {
	const commands = [];

	const __dirname = path.resolve();
  
	const commandsPath = path.join(__dirname, '/target/commands/');
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

	// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
	for (const file of commandFiles) {
		const filePath = path.join('file://', commandsPath, file);
		const command = await import(filePath);
		if (command instanceof Object && 'data' in command && 'execute' in command) {
			commands.push(command.data.toJSON());
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}  
	}
	
	// Construct and prepare an instance of the REST module
	const rest = new REST().setToken(token);
	
	// and deploy your commands!
	(async () => {
		try {
			console.log(`Started refreshing ${commands.length} application (/) commands.`);
	
			// The put method is used to fully refresh all commands in the guild with the current set
			const data: any = await rest.put(
				Routes.applicationGuildCommands(clientId, guildId),
				{ body: commands },
			);
	
			console.log(`Successfully reloaded ${data.length} application (/) commands.`);
		} catch (error) {
			// And of course, make sure you catch and log any errors!
			console.error(error);
		}
	})();
}