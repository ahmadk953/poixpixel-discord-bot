import fs from 'node:fs';
import path from 'node:path';
import { REST, Routes } from 'discord.js';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadConfig } from './configLoader.js';
import { logger } from './logger.js';

const config = loadConfig();
const { token, clientId, guildId } = config;

interface CommandLoadConfig {
  commandsPath: string;
  extensions: string[];
}

const resolveCommandLoadConfig = (): CommandLoadConfig => {
  const workspaceRoot = process.cwd();
  const currentFilePath = fileURLToPath(import.meta.url);
  const isRunningFromTarget = currentFilePath.includes(
    `${path.sep}target${path.sep}`,
  );

  const preferred = isRunningFromTarget
    ? {
        commandsPath: path.join(workspaceRoot, 'target', 'commands'),
        extensions: ['.js'],
      }
    : {
        commandsPath: path.join(workspaceRoot, 'src', 'commands'),
        extensions: ['.ts', '.js'],
      };

  if (fs.existsSync(preferred.commandsPath)) {
    return preferred;
  }

  const fallback = isRunningFromTarget
    ? {
        commandsPath: path.join(workspaceRoot, 'src', 'commands'),
        extensions: ['.ts', '.js'],
      }
    : {
        commandsPath: path.join(workspaceRoot, 'target', 'commands'),
        extensions: ['.js'],
      };

  return fallback;
};

const { commandsPath, extensions } = resolveCommandLoadConfig();

const rest = new REST({ version: '10' }).setToken(token);

/**
 * Gets all files in the command directory and its subdirectories
 * @param directory - The directory to get files from
 * @param allowedExtensions - Allowed file extensions (with leading dot)
 * @returns - An array of file paths
 */
export const getFilesRecursively = (
  directory: string,
  allowedExtensions: string[] = ['.js'],
): string[] => {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const files: string[] = [];
  const filesInDirectory = fs.readdirSync(directory);

  for (const file of filesInDirectory) {
    const filePath = path.join(directory, file);

    if (fs.statSync(filePath).isDirectory()) {
      files.push(...getFilesRecursively(filePath, allowedExtensions));
    } else if (allowedExtensions.includes(path.extname(filePath))) {
      files.push(filePath);
    }
  }

  return files;
};

const commandFiles = getFilesRecursively(commandsPath, extensions);

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
      const commandModule = await import(pathToFileURL(file).href);
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

    const loadedCommands = await Promise.all(commands);
    const validCommands = loadedCommands.filter((command) => command !== null);

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
