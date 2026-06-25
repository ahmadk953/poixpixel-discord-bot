import {
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';

import type { Command } from '@/types/CommandTypes.js';
import { getConfigLoadTime, reloadConfig } from '@/util/configLoader.js';
import { safelyRespond, validateInteraction } from '@/util/helpers.js';
import { logger } from '@/util/logger.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('reload-config')
    .setDescription('Reload the bot configuration from disk')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  execute: async (interaction) => {
    if (!(await validateInteraction(interaction))) {
      await safelyRespond(interaction, 'Invalid interaction.', true);
      return;
    }

    await interaction.deferReply({ flags: ['Ephemeral'] });

    try {
      const previousLoadTime = getConfigLoadTime();

      await safelyRespond(
        interaction,
        '🔄 Reloading configuration from disk...'
      );

      const newConfig = await reloadConfig();
      const newLoadTime = getConfigLoadTime();

      const embed = new EmbedBuilder()
        .setTitle('✅ Configuration Reloaded Successfully')
        .setColor(0x00_ff_00)
        .addFields(
          {
            name: 'Previous Load Time',
            value: previousLoadTime
              ? `<t:${Math.floor(previousLoadTime / 1000)}:F>`
              : 'Never loaded',
            inline: true,
          },
          {
            name: 'New Load Time',
            value: newLoadTime
              ? `<t:${Math.floor(newLoadTime / 1000)}:F>`
              : 'Unknown',
            inline: true,
          },
          {
            name: 'Guild ID',
            value: newConfig.guildId,
            inline: true,
          }
        )
        .setFooter({
          text: 'Configuration has been reloaded from config.json',
        })
        .setTimestamp();

      await interaction.editReply({
        content: null,
        embeds: [embed],
      });

      const idSuffix = interaction.user.id?.slice(-4) ?? 'unknown';
      logger.info(
        `Configuration reloaded by a user (ID ending in ${idSuffix})`
      );
    } catch (error) {
      logger.error(
        '[ReloadConfigCommand] Error executing reload config command',
        error
      );

      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Configuration Reload Failed')
        .setColor(0xff_00_00)
        .setDescription(
          `Failed to reload configuration from disk:\n\`\`\`${error}\`\`\``
        )
        .setTimestamp();

      await interaction.editReply({
        content: null,
        embeds: [errorEmbed],
      });
    }
  },
};

export default command;
