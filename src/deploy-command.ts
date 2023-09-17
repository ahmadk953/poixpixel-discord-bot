import * as fs from 'fs/promises';
import path from 'path';
import { REST } from '@discordjs/rest';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.resolve();

// Define the path to the directory containing your command files
const foldersPath = path.join(__dirname, '\\target\\commands'); // Change 'commands' to your actual directory name

export async function registerCommands(clientId: any, guildId: any, token: any) {
    const commands = [];

    try {
        const commandFolders = await fs.readdir(foldersPath);

        for (const folder of commandFolders) {
            const commandsPath = path.join(foldersPath, folder);
            const commandFiles = (await fs.readdir(commandsPath)).filter(file => file.endsWith('.js'));

            for (const file of commandFiles) {
                const filePath = path.join('file://', commandsPath, file);

                // Import the module and handle any potential errors
                let commandModule;
                try {
                    commandModule = await import(filePath);
                } catch (error) {
                    console.error(`Error importing module from ${filePath}: ${error}`);
                    continue; // Continue to the next module on error
                }

                // Check if the imported module has 'data' and 'execute' properties
                if ('data' in commandModule && 'execute' in commandModule) {
                    commands.push(commandModule.data.toJSON());
                } else {
                    console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
                }
            }
        }

        const rest = new REST({ version: '10' }).setToken(token);

        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        const data: any = await rest.put(
            `/applications/${clientId}/guilds/${guildId}/commands`,
            { body: commands }
        );

        console.log(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        console.error(error);
    }
}
