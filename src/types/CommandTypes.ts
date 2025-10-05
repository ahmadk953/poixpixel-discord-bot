import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';

/**
 * Command interface for normal commands
 */
export interface Command {
  data: Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;
  // eslint-disable-next-line no-unused-vars
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

/**
 * Command interface for options commands
 */
export interface OptionsCommand {
  data: SlashCommandOptionsOnlyBuilder;
  // eslint-disable-next-line no-unused-vars
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

/**
 * Command interface for subcommand commands
 */
export interface SubcommandCommand {
  data: SlashCommandSubcommandsOnlyBuilder;
  // eslint-disable-next-line no-unused-vars
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}
