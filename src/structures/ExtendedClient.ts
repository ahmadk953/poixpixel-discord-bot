import { Client, type ClientOptions, Collection } from 'discord.js';
import type { Command } from '@/types/CommandTypes.js';
import type { Config } from '@/types/ConfigTypes.js';
import {
  deployCommands,
  getFilesRecursively,
  resolveCommandLoadConfig,
} from '@/util/deployCommand.js';
import { registerEvents } from '@/util/eventLoader.js';
import { logger } from '@/util/logger.js';
import { pathToFileURL } from 'node:url';

/**
 * Extended client class that extends the default Client class
 */
export class ExtendedClient extends Client {
  public commands: Collection<string, Command>;
  private config: Config;

  constructor(options: ClientOptions, config: Config) {
    super(options);
    this.commands = new Collection();
    this.config = config;
  }

  async initialize() {
    try {
      await this.loadModules();
      await this.login(this.config.token);
    } catch (error) {
      logger.log(
        'fatal',
        '[ExtendedClient] Failed to initialize client',
        error,
      );
      process.exit(1);
    }
  }

  private async loadModules() {
    try {
      const commands = await deployCommands();
      if (!commands?.length) {
        throw new Error('No commands found');
      }

      for (const command of commands) {
        this.commands.set(command.data.name, command);
      }

      await registerEvents(this);
      logger.info(
        `[ExtendedClient] Loaded ${commands.length} commands and registered events`,
      );
    } catch (error) {
      logger.log('fatal', '[ExtendedClient] Error loading modules', error);
      process.exit(1);
    }
  }

  /**
   * Loads commands without deploying them to Discord
   * @returns Array of command objects
   */
  private async loadCommandsWithoutDeploying(): Promise<Command[]> {
    const { commandsPath, extensions } = resolveCommandLoadConfig();
    const commandFiles = getFilesRecursively(commandsPath, extensions);

    const commands: Command[] = [];
    for (const file of commandFiles) {
      const commandModule = await import(pathToFileURL(file).href);
      const command = commandModule.default;

      if (
        command instanceof Object &&
        'data' in command &&
        'execute' in command
      ) {
        commands.push(command);
        this.commands.set(command.data.name, command);
      } else {
        logger.warn(
          `[ExtendedClient] The command at ${file} is missing a required "data" or "execute" property.`,
        );
      }
    }

    return commands;
  }
}
