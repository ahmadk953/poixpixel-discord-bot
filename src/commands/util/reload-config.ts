import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';

import { Command } from '@/types/CommandTypes.js';
import { reloadConfig, getConfigLoadTime } from '@/util/configLoader.js';
import { logger } from '@/util/logger.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('reload-config')
    .setDescription('Reload the bot configuration from disk')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  execute: async (interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    await interaction.deferReply({ flags: ['Ephemeral'] });

    try {
      const previousLoadTime = getConfigLoadTime();

      await interaction.editReply({
        content: '🔄 Reloading configuration from disk...',
      });

      const newConfig = reloadConfig();
      const newLoadTime = getConfigLoadTime();

      const embed = new EmbedBuilder()
        .setTitle('✅ Configuration Reloaded Successfully')
        .setColor(0x00ff00)
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
          },
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
        `Configuration reloaded by a user (ID ending in ${idSuffix})`,
      );
    } catch (error) {
      logger.error(
        '[ReloadConfigCommand] Error executing reload config command',
        error,
      );

      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Configuration Reload Failed')
        .setColor(0xff0000)
        .setDescription(
          `Failed to reload configuration from disk:\n\`\`\`${error}\`\`\``,
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
