import {
  CommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
} from 'discord.js';

export interface Command {
  data: Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;
  execute: (interaction: CommandInteraction) => Promise<void>;
}

export interface OptionsCommand {
  data: SlashCommandOptionsOnlyBuilder;
  execute: (interaction: CommandInteraction) => Promise<void>;
}
