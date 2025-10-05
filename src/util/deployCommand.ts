import fs from 'fs';
import path from 'path';
import { REST, Routes } from 'discord.js';

import { loadConfig } from './configLoader.js';
import { logger } from './logger.js';

const config = loadConfig();
const { token, clientId, guildId } = config;

const __dirname = path.resolve();
const commandsPath = path.join(__dirname, 'target', 'commands');

const rest = new REST({ version: '10' }).setToken(token);

/**
 * Gets all files in the command directory and its subdirectories
 * @param directory - The directory to get files from
 * @returns - An array of file paths
 */
export const getFilesRecursively = (directory: string): string[] => {
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

/**
 * Registers all commands in the command directory with the Discord API
 * @returns - An array of valid command objects
 */
export const deployCommands = async () => {
  try {
    logger.info(
      `[DeployCommands] Started refreshing ${commandFiles.length} application (/) commands...`,
    );

    logger.info('[DeployCommands] Undeploying all existing commands...');
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: [],
    });
    logger.info('[DeployCommands] Successfully undeployed all commands');

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
        logger.warn(
          `[DeployCommands] The command at ${file} is missing a required "data" or "execute" property.`,
        );
        return null;
      }
    });

    const validCommands = await Promise.all(
      commands.filter((command) => command !== null),
    );

    const apiCommands = validCommands.map((command) => command.data.toJSON());

    const data = (await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: apiCommands },
    )) as unknown[];

    logger.info(
      `[DeployCommands] Successfully registered ${data.length} application (/) commands with the Discord API.`,
    );

    return validCommands;
  } catch (error) {
    logger.error('[DeployCommands] Failed to deploy commands', error);
  }
};
