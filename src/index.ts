import fs from 'fs';
import path from 'path';
import { Client, Collection, GatewayIntentBits, Interaction } from 'discord.js';
import { registerCommands } from './deploy-command.js';
import config from './config.json' assert { type: 'json' };

const { clientId, guildId, token } = config;

class CustomClient extends Client {
    commands: Collection<any, any> = new Collection();
}

const client = new CustomClient({ intents: [GatewayIntentBits.Guilds] });

function initializeCommands() {
    const __dirname = path.resolve();
    const foldersPath = path.join(__dirname, '\\target\\commands');

    console.log(`Folder Path Received: ${foldersPath}`);

    try {
        const commandFiles = fs.readdirSync(foldersPath);
        for (const file of commandFiles) {
            if (file.endsWith('.js')) {
                const command = require(path.join(foldersPath, file));
                console.log(command);
                client.commands.set(command.name, command);
            }
        }
        console.log('Commands initialized successfully!');
    } catch (error) {
        console.error('Error initializing commands:', error);
    }
}

initializeCommands();

try {
    await registerCommands(clientId, guildId, token);
} catch (error) {
    console.error("Error registering slash commands:", error);
}

client.once('ready', () => {
    console.log('Ready!');
});

client.on('interactionCreate', async (interaction: Interaction) => {
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) return;

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

client.login(token);