import { performance } from 'node:perf_hooks';

import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';

import type { Command } from '@/types/CommandTypes.js';
import { safelyRespond, validateInteraction } from '@/util/helpers.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the latency from you to the bot'),
  execute: async (interaction) => {
    if (!(await validateInteraction(interaction))) {
      await safelyRespond(
        interaction,
        'Invalid interaction. Please try again.',
        true
      );
      return;
    }

    const startedAt = performance.now();
    const roundTripLatency = Date.now() - interaction.createdTimestamp;
    const websocketLatency = interaction.client.ws.ping;
    const handlerLatency = Math.max(
      0,
      Math.round(performance.now() - startedAt)
    );
    const websocketLatencyLabel =
      websocketLatency >= 0
        ? `${Math.round(websocketLatency)}ms`
        : 'unavailable';

    const pingEmbed = new EmbedBuilder()
      .setTitle('🏓 Pong!')
      .setColor(0x00_ff_00)
      .addFields([
        { name: 'Round-trip', value: `${roundTripLatency}ms`, inline: true },
        { name: 'Websocket', value: websocketLatencyLabel, inline: true },
        { name: 'Handler', value: `${handlerLatency}ms`, inline: true },
      ])
      .setTimestamp();

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ embeds: [pingEmbed] });
      return;
    }

    await interaction.reply({ embeds: [pingEmbed] });
  },
};

export default command;
