// Require the necessary discord.js classes
import fs from'node:fs';
import path from 'node:path';
import { Client, Collection, Events, GatewayIntentBits } from'discord.js';
import config from './config.json' assert { type: 'json' };
import { deployCommands } from './util/deployCommand.js';

const { token } = config;

// Create a new client instance
const client: any = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

try {
	const __dirname = path.resolve();
  
	const commandsPath = path.join(__dirname, '/target/commands/');
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  
	for (const file of commandFiles) {
	  const filePath = path.join('file://', commandsPath, file);
	  const commandModule = await import(filePath);
	  const command = commandModule.default;
  
	  if (command instanceof Object && 'data' in command && 'execute' in command) {
		client.commands.set(command.data.name, command);
	  } else {
		console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
	  }
	}
} catch (error: any) {
    console.log(`Error while getting commands up: ${error}`)
}

try {
    await deployCommands();
} catch (error: any) {
    console.log(`Error while registering commands: ${error}`)
}

// When the client is ready, run this code (only once)
// We use 'c' for the event parameter to keep it separate from the already defined 'client'
client.once(Events.ClientReady, (c: any) => {
	console.log(`Ready! Logged in as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction: any) => {
	if (!interaction.isChatInputCommand()) return;

	const command = interaction.client.commands.get(interaction.commandName);

	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
		} else {
			await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
		}
	}
});

// Log in to Discord with your client's token
client.login(token);