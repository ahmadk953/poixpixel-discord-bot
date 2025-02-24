import { REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { loadConfig } from './configLoader.js';

const config = loadConfig();
const { token, clientId, guildId } = config;

const __dirname = path.resolve();
const commandsPath = path.join(__dirname, 'target', 'commands');

const rest = new REST({ version: '10' }).setToken(token);

const getFilesRecursively = (directory: string): string[] => {
  const files: string[] = [];
  const filesInDirectory = fs.readdirSync(directory);

  for (const file of filesInDirectory) {
    const filePath = path.join(directory, file);

    if (fs.statSync(filePath).isDirectory()) {
      files.push(...getFilesRecursively(filePath));
    } else if (file.endsWith('.js')) {
      files.push(filePath);
    }
  }

  return files;
};

const commandFiles = getFilesRecursively(commandsPath);

export const deployCommands = async () => {
  try {
    console.log(
      `Started refreshing ${commandFiles.length} application (/) commands...`,
    );

    const existingCommands = (await rest.get(
      Routes.applicationGuildCommands(clientId, guildId),
    )) as any[];

    const commands = commandFiles.map(async (file) => {
      const commandModule = await import(`file://${file}`);
      const command = commandModule.default;

      if (
        command instanceof Object &&
        'data' in command &&
        'execute' in command
      ) {
        return command;
      } else {
        console.warn(
          `[WARNING] The command at ${file} is missing a required "data" or "execute" property.`,
        );
        return null;
      }
    });

    const validCommands = await Promise.all(
      commands.filter((command) => command !== null),
    );

    const apiCommands = validCommands.map((command) => command.data.toJSON());

    const commandsToRemove = existingCommands.filter(
      (existingCmd) =>
        !apiCommands.some((newCmd) => newCmd.name === existingCmd.name),
    );

    for (const cmdToRemove of commandsToRemove) {
      await rest.delete(
        Routes.applicationGuildCommand(clientId, guildId, cmdToRemove.id),
      );
      console.log(`Removed command: ${cmdToRemove.name}`);
    }

    const data: any = await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: apiCommands },
    );

    console.log(
      `Successfully registered ${data.length} application (/) commands with the Discord API.`,
    );

    return validCommands;
  } catch (error) {
    console.error(error);
  }
};
