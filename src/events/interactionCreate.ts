import { Events, Interaction } from 'discord.js';

import { ExtendedClient } from '../structures/ExtendedClient.js';
import { Event } from '../types/EventTypes.js';
import { approveFact, deleteFact } from '../db/db.js';

export default {
  name: Events.InteractionCreate,
  execute: async (interaction: Interaction) => {
    if (interaction.isCommand()) {
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
    } else if (interaction.isButton()) {
      const { customId } = interaction;

      if (customId.startsWith('approve_fact_')) {
        if (!interaction.memberPermissions?.has('ModerateMembers')) {
          await interaction.reply({
            content: 'You do not have permission to approve facts.',
            ephemeral: true,
          });
          return;
        }

        const factId = parseInt(customId.replace('approve_fact_', ''), 10);
        await approveFact(factId);

        await interaction.update({
          content: `✅ Fact #${factId} has been approved by <@${interaction.user.id}>`,
          components: [],
        });
      } else if (customId.startsWith('reject_fact_')) {
        if (!interaction.memberPermissions?.has('ModerateMembers')) {
          await interaction.reply({
            content: 'You do not have permission to reject facts.',
            ephemeral: true,
          });
          return;
        }

        const factId = parseInt(customId.replace('reject_fact_', ''), 10);
        await deleteFact(factId);

        await interaction.update({
          content: `❌ Fact #${factId} has been rejected by <@${interaction.user.id}>`,
          components: [],
        });
      }
    } else {
      console.log('Unhandled interaction type:', interaction);
      return;
    }
  },
} as Event<typeof Events.InteractionCreate>;
