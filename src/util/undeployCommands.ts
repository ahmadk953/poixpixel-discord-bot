import { REST, Routes } from 'discord.js';
import { loadConfig } from './configLoader.js';

const config = loadConfig();
const { token, clientId, guildId } = config;

const rest = new REST({ version: '10' }).setToken(token);

/**
 * Undeploys all commands from the Discord API
 */
export const undeployCommands = async () => {
  try {
    console.log('Undeploying all commands from the Discord API...');

    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: [],
    });

    console.log('Successfully undeployed all commands');
  } catch (error) {
    console.error('Error undeploying commands:', error);
    throw error;
  }
};

if (import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  undeployCommands()
    .then(() => {
      console.log('Undeploy process completed successfully');
    })
    .catch((err) => {
      console.error('Undeploy process failed:', err);
      process.exitCode = 1;
    });
}
