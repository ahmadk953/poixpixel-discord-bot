import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { REST, Routes } from 'discord.js';

import { loadConfig } from './configLoader.js';
import { logger } from './logger.js';

const config = loadConfig();
const { token, clientId, guildId } = config;

interface CommandLoadConfig {
  commandsPath: string;
  extensions: string[];
}

type CommandSourcePreference = 'auto' | 'src' | 'target';

interface DeployStateEntry {
  commandCount: number;
  hash: string;
  updatedAt: string;
}

type DeployState = Record<string, DeployStateEntry>;

const COMMANDS_SOURCE_ENV = 'COMMANDS_SOURCE';
const FORCE_COMMAND_DEPLOY_ENV = 'FORCE_COMMAND_DEPLOY';
const DEPLOY_STATE_PATH = path.join(
  process.cwd(),
  'temp',
  'command-deploy-state.json'
);

const parseCommandSourcePreference = (): CommandSourcePreference => {
  const source = process.env[COMMANDS_SOURCE_ENV]?.trim().toLowerCase();

  if (!source || source === 'auto') {
    return 'auto';
  }

  if (source === 'src' || source === 'target') {
    return source;
  }

  throw new Error(
    `[DeployCommands] Invalid ${COMMANDS_SOURCE_ENV} value: "${source}". Expected one of "auto", "src", or "target".`
  );
};

const isDirectory = (targetPath: string): boolean => {
  if (!fs.existsSync(targetPath)) {
    return false;
  }

  try {
    return fs.statSync(targetPath).isDirectory();
  } catch {
    return false;
  }
};

const getConfigForSource = (
  workspaceRoot: string,
  source: Exclude<CommandSourcePreference, 'auto'>
): CommandLoadConfig => {
  if (source === 'target') {
    return {
      commandsPath: path.join(workspaceRoot, 'target', 'commands'),
      extensions: ['.js'],
    };
  }

  return {
    commandsPath: path.join(workspaceRoot, 'src', 'commands'),
    extensions: ['.ts', '.js'],
  };
};

const readDeployState = (): DeployState => {
  if (!fs.existsSync(DEPLOY_STATE_PATH)) {
    return {};
  }

  try {
    const rawState = fs.readFileSync(DEPLOY_STATE_PATH, 'utf-8');
    const parsed = JSON.parse(rawState) as unknown;

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      logger.warn(
        `[DeployCommands] Ignoring malformed deploy state file at "${DEPLOY_STATE_PATH}".`
      );
      return {};
    }

    return parsed as DeployState;
  } catch (error) {
    logger.warn('[DeployCommands] Failed to read deploy state file', {
      statePath: DEPLOY_STATE_PATH,
      error,
    });
    return {};
  }
};

const writeDeployState = (state: DeployState): void => {
  try {
    fs.mkdirSync(path.dirname(DEPLOY_STATE_PATH), { recursive: true });
    fs.writeFileSync(
      DEPLOY_STATE_PATH,
      JSON.stringify(state, null, 2),
      'utf-8'
    );
  } catch (error) {
    logger.warn('[DeployCommands] Failed to persist deploy state', {
      statePath: DEPLOY_STATE_PATH,
      error,
    });
  }
};

const getDeployStateKey = (): string => `${clientId}:${guildId}`;

const createCommandFingerprint = (apiCommands: unknown[]): string => {
  return createHash('sha256').update(JSON.stringify(apiCommands)).digest('hex');
};

const isForceCommandDeployEnabled = (): boolean => {
  return process.env[FORCE_COMMAND_DEPLOY_ENV] === 'true';
};

const shouldDeployCommands = (fingerprint: string): boolean => {
  if (isForceCommandDeployEnabled()) {
    logger.info(
      `[DeployCommands] ${FORCE_COMMAND_DEPLOY_ENV}=true; forcing command deployment.`
    );
    return true;
  }

  const state = readDeployState();
  const previous = state[getDeployStateKey()];

  if (previous?.hash === fingerprint) {
    logger.info(
      '[DeployCommands] Command definitions unchanged; skipping Discord command deploy.',
      {
        commandCount: previous.commandCount,
        updatedAt: previous.updatedAt,
      }
    );
    return false;
  }

  return true;
};

const saveCommandFingerprint = (
  fingerprint: string,
  commandCount: number
): void => {
  const state = readDeployState();
  state[getDeployStateKey()] = {
    hash: fingerprint,
    commandCount,
    updatedAt: new Date().toISOString(),
  };

  writeDeployState(state);
};

export const clearCommandFingerprintCache = (): void => {
  const state = readDeployState();
  const key = getDeployStateKey();

  if (!(key in state)) {
    return;
  }

  const nextState = Object.fromEntries(
    Object.entries(state).filter(([entryKey]) => entryKey !== key)
  ) as DeployState;

  writeDeployState(nextState);

  logger.info(
    '[DeployCommands] Cleared local command deploy fingerprint cache',
    {
      key,
    }
  );
};

export const resolveCommandLoadConfig = (): CommandLoadConfig => {
  const workspaceRoot = process.cwd();
  const currentFilePath = fileURLToPath(import.meta.url);
  const sourcePreference = parseCommandSourcePreference();
  const isRunningFromTarget = currentFilePath.includes(
    `${path.sep}target${path.sep}`
  );

  if (sourcePreference !== 'auto') {
    const configured = getConfigForSource(workspaceRoot, sourcePreference);

    if (!isDirectory(configured.commandsPath)) {
      if (sourcePreference === 'target') {
        throw new Error(
          `[DeployCommands] Missing compiled commands directory at "${configured.commandsPath}" while ${COMMANDS_SOURCE_ENV}=target. Run the TypeScript build before deploying commands.`
        );
      }

      throw new Error(
        `[DeployCommands] Missing source commands directory at "${configured.commandsPath}" while ${COMMANDS_SOURCE_ENV}=src.`
      );
    }

    return configured;
  }

  const preferred = isRunningFromTarget
    ? {
        commandsPath: path.join(workspaceRoot, 'target', 'commands'),
        extensions: ['.js'],
      }
    : {
        commandsPath: path.join(workspaceRoot, 'src', 'commands'),
        extensions: ['.ts', '.js'],
      };

  if (isDirectory(preferred.commandsPath)) {
    return preferred;
  }

  if (isRunningFromTarget) {
    throw new Error(
      `[DeployCommands] Missing compiled commands directory at "${preferred.commandsPath}". Run the TypeScript build before deploying commands.`
    );
  }

  const fallback = {
    commandsPath: path.join(workspaceRoot, 'target', 'commands'),
    extensions: ['.js'],
  };

  if (isDirectory(fallback.commandsPath)) {
    return fallback;
  }

  throw new Error(
    `[DeployCommands] Could not find commands directory. Checked "${preferred.commandsPath}" and "${fallback.commandsPath}".`
  );
};

const rest = new REST({ version: '10' }).setToken(token);

/**
 * Gets all files in the command directory and its subdirectories
 * @param directory - The directory to get files from
 * @param allowedExtensions - Allowed file extensions (with leading dot)
 * @returns - An array of file paths
 */
export const getFilesRecursively = (
  directory: string,
  allowedExtensions: string[] = ['.js']
): string[] => {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const files: string[] = [];
  const filesInDirectory = fs
    .readdirSync(directory)
    .sort((a, b) => a.localeCompare(b));

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

/**
 * Registers all commands in the command directory with the Discord API
 * @returns - An array of valid command objects
 */
export const deployCommands = async () => {
  try {
    const { commandsPath, extensions } = resolveCommandLoadConfig();
    const commandFiles = getFilesRecursively(commandsPath, extensions);

    logger.info(
      `[DeployCommands] Started refreshing ${commandFiles.length} application (/) commands...`
    );

    const commands = commandFiles.map(async (file) => {
      const commandModule = await import(pathToFileURL(file).href);
      const command = commandModule.default;

      if (
        command instanceof Object &&
        typeof command.data?.toJSON === 'function' &&
        typeof command.execute === 'function'
      ) {
        return command;
      }
      logger.warn(
        `[DeployCommands] The command at ${file} is missing a valid "data.toJSON" method or "execute" function.`
      );
      return null;
    });

    const loadedCommands = await Promise.all(commands);
    const validCommands = loadedCommands.filter((command) => command !== null);
    validCommands.sort((a, b) => a.data.name.localeCompare(b.data.name));

    if (validCommands.length === 0) {
      logger.error('[DeployCommands] Aborting deploy: no valid commands', {
        loadedCount: loadedCommands.length,
        validCount: validCommands.length,
        commandsPath,
      });
      throw new Error(
        '[DeployCommands] No valid commands were loaded; deployment aborted.'
      );
    }

    const apiCommands = validCommands.map((command) => command.data.toJSON());
    const fingerprint = createCommandFingerprint(apiCommands);

    if (!shouldDeployCommands(fingerprint)) {
      return validCommands;
    }

    const data = (await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: apiCommands }
    )) as unknown[];

    saveCommandFingerprint(fingerprint, validCommands.length);

    logger.info(
      `[DeployCommands] Successfully registered ${data.length} application (/) commands with the Discord API.`
    );

    return validCommands;
  } catch (error) {
    logger.error('[DeployCommands] Failed to deploy commands', error);
    throw error;
  }
};
