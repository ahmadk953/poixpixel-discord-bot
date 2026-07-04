import { Client, type ClientOptions, Collection } from 'discord.js';

import type { Command } from '@/types/CommandTypes.js';
import type { Config } from '@/types/ConfigTypes.js';
import { deployCommands } from '@/util/deployCommand.js';
import { registerEvents } from '@/util/eventLoader.js';
import { logger } from '@/util/logger.js';

/**
 * Extended client class that extends the default Client class
 */
export class ExtendedClient extends Client {
  readonly commands: Collection<string, Command>;
  private readonly config: Config;

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
        error
      );
      throw error;
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
        `[ExtendedClient] Loaded ${commands.length} commands and registered events`
      );
    } catch (error) {
      logger.log('fatal', '[ExtendedClient] Error loading modules', error);
      throw error;
    }
  }
}
