import { REST, Routes } from 'discord.js';
import { loadConfig } from './configLoader.js';
import { initLogger, logger } from './logger.js';

const config = loadConfig();
const { token, clientId, guildId } = config;

const rest = new REST({ version: '10' }).setToken(token);

/**
 * Undeploys all commands from the Discord API
 */
export const undeployCommands = async () => {
  try {
    initLogger();
    logger.info(
      '[UndeployCommands] Undeploying all commands from the Discord API...',
    );

    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: [],
    });

    logger.info('[UndeployCommands] Successfully undeployed all commands');
  } catch (error) {
    logger.error('[UndeployCommands] Error undeploying commands', error);
    throw error;
  }
};

if (import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  undeployCommands()
    .then(() => {
      logger.info('[UndeployCommands] Undeploy process completed successfully');
    })
    .catch((error) => {
      logger.error('[UndeployCommands] Undeploy process failed', error);
      process.exitCode = 1;
    });
}
