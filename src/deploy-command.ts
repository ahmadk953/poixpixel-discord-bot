import { REST } from 'discord.js';
import fs from 'fs';
import path from 'path';

const commands: any = [];
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

export async function registerCommands(clientId: any, guildId: any, token: any) {
    for (const folder of commandFolders) {
        const commandsPath = path.join(foldersPath, folder);
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts'));
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = await import(filePath);
            if ('data' in command && 'execute' in command) {
                commands.push(command.data.toJSON());
            } else {
                console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
            }
        }
    }
    
    const rest = new REST().setToken(token);
    
    (async () => {
        try {
            console.log(`Started refreshing ${commands.length} application (/) commands.`);
    
            const data: any = await rest.put(
                `/applications/${clientId}/guilds/${guildId}/commands`,
                { body: commands }
            );
    
            console.log(`Successfully reloaded ${data.length} application (/) commands.`);
        } catch (error) {
            console.error(error);
        }
    })();
}

export default registerCommands;