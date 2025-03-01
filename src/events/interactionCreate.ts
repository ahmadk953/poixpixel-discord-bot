import { Events, Interaction } from 'discord.js';

import { ExtendedClient } from '../structures/ExtendedClient.js';
import { Event } from '../types/EventTypes.js';

export default {
  name: Events.InteractionCreate,
  execute: async (interaction: Interaction) => {
    if (!interaction.isCommand()) return;

    const client = interaction.client as ExtendedClient;
    const command = client.commands.get(interaction.commandName);

    if (!command) {
      console.error(
        `No command matching ${interaction.commandName} was found.`,
      );
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Error executing ${interaction.commandName}`);
      console.error(error);

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: 'There was an error while executing this command!',
          flags: ['Ephemeral'],
        });
      } else {
        await interaction.reply({
          content: 'There was an error while executing this command!',
          flags: ['Ephemeral'],
        });
      }
    }
  },
} as Event<typeof Events.InteractionCreate>;
