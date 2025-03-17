import { Client, ClientOptions, Collection } from 'discord.js';
import { Command } from '../types/CommandTypes.js';
import { Config } from '../types/ConfigTypes.js';
import { deployCommands } from '../util/deployCommand.js';
import { registerEvents } from '../util/eventLoader.js';

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
      console.error('Failed to initialize client:', error);
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
      console.log(`Loaded ${commands.length} commands and registered events`);
    } catch (error) {
      console.error('Error loading modules:', error);
      process.exit(1);
    }
  }
}
