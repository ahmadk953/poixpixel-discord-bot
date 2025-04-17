import { Client, ClientOptions, Collection } from 'discord.js';
import { Command } from '@/types/CommandTypes.js';
import { Config } from '@/types/ConfigTypes.js';
import { deployCommands, getFilesRecursively } from '@/util/deployCommand.js';
import { registerEvents } from '@/util/eventLoader.js';

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
      if (process.env.SKIP_COMMAND_DEPLOY === 'true') {
        console.log('Skipping command deployment (SKIP_COMMAND_DEPLOY=true)');
        const commandFiles = await this.loadCommandsWithoutDeploying();

        if (!commandFiles?.length) {
          throw new Error('No commands found');
        }

        await registerEvents(this);
        console.log(
          `Loaded ${commandFiles.length} commands and registered events (without deployment)`,
        );
      } else {
        const commands = await deployCommands();
        if (!commands?.length) {
          throw new Error('No commands found');
        }

        for (const command of commands) {
          this.commands.set(command.data.name, command);
        }

        await registerEvents(this);
        console.log(`Loaded ${commands.length} commands and registered events`);
      }
    } catch (error) {
      console.error('Error loading modules:', error);
      process.exit(1);
    }
  }

  /**
   * Loads commands without deploying them to Discord
   * @returns Array of command objects
   */
  private async loadCommandsWithoutDeploying(): Promise<Command[]> {
    try {
      const path = await import('path');

      const __dirname = path.resolve();
      const commandsPath = path.join(__dirname, 'target', 'commands');

      const commandFiles = getFilesRecursively(commandsPath);

      const commands: Command[] = [];
      for (const file of commandFiles) {
        const commandModule = await import(`file://${file}`);
        const command = commandModule.default;

        if (
          command instanceof Object &&
          'data' in command &&
          'execute' in command
        ) {
          commands.push(command);
          this.commands.set(command.data.name, command);
        } else {
          console.warn(
            `[WARNING] The command at ${file} is missing a required "data" or "execute" property.`,
          );
        }
      }

      return commands;
    } catch (error) {
      console.error('Error loading commands:', error);
      throw error;
    }
  }
}
