import { REST, Routes } from 'discord.js';
import config from '../config.json' assert { type: 'json' };
import fs from 'fs';
import path from 'path';

const { token, clientId, guildId } = config;

const __dirname = path.resolve();
const commandsPath = path.join(__dirname, 'target', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

const rest = new REST({ version: '9' }).setToken(token);

export const deployCommands = async () => {
  try {
    console.log(`Started refreshing ${commandFiles.length} application (/) commands.`);

    const commands = commandFiles.map(async (file) => {
      const filePath = path.join('file://', commandsPath, file);
      const commandModule = await import(filePath);
      const command = commandModule.default;
      
      if (command instanceof Object && 'data' in command) {
        return command.data.toJSON();
      } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" property.`);
        return null;
      }
    });

    const validCommands = await Promise.all(commands.filter(command => command !== null));

    const data: any = await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: validCommands },
    );

    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    console.error(error);
  }
};