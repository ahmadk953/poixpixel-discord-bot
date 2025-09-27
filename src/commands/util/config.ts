import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';

import { Command } from '@/types/CommandTypes.js';
import { loadConfig } from '@/util/configLoader.js';
import {
  createPaginationButtons,
  safeRemoveComponents,
} from '@/util/helpers.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Display the current configuration')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  execute: async (interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    await interaction.deferReply({ flags: ['Ephemeral'] });

    const config = loadConfig();
    const displayConfig = JSON.parse(JSON.stringify(config));

    if (displayConfig.token) displayConfig.token = '••••••••••••••••••••••••••';
    if (displayConfig.database) {
      if (displayConfig.database.poolingDbConnectionString) {
        displayConfig.database.poolingDbConnectionString =
          '••••••••••••••••••••••••••';
      } else if (displayConfig.database.directDbConnectionString) {
        displayConfig.database.directDbConnectionString =
          '••••••••••••••••••••••••••';
      }
    }
    if (displayConfig.redis?.redisConnectionString) {
      displayConfig.redis.redisConnectionString = '••••••••••••••••••••••••••';
    }

    const pages: EmbedBuilder[] = [];

    const basicConfigEmbed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('Bot Configuration')
      .setDescription(
        'Current configuration settings (sensitive data redacted)',
      )
      .addFields(
        {
          name: 'Client ID',
          value: displayConfig.clientId || 'Not set',
          inline: true,
        },
        {
          name: 'Guild ID',
          value: displayConfig.guildId || 'Not set',
          inline: true,
        },
        {
          name: 'Token',
          value: displayConfig.token || 'Not set',
          inline: true,
        },
      );

    pages.push(basicConfigEmbed);

    if (displayConfig.database || displayConfig.redis) {
      const dbRedisEmbed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('Database and Redis Configuration')
        .setDescription('Database and cache settings');

      if (displayConfig.database) {
        const dbConn =
          displayConfig.database.poolingDbConnectionString ??
          displayConfig.database.directDbConnectionString ??
          'Not set';
        dbRedisEmbed.addFields({
          name: 'Database',
          value: `Connection: ${dbConn}\nMax Retry: ${displayConfig.database.maxRetryAttempts}\nRetry Delay: ${displayConfig.database.retryDelay}ms`,
        });
      }

      if (displayConfig.redis) {
        dbRedisEmbed.addFields({
          name: 'Redis',
          value: `Connection: ${displayConfig.redis.redisConnectionString}\nRetry Attempts: ${displayConfig.redis.retryAttempts}\nInitial Retry Delay: ${displayConfig.redis.initialRetryDelay}ms`,
        });
      }

      pages.push(dbRedisEmbed);
    }

    if (displayConfig.channels || displayConfig.roles) {
      const channelsRolesEmbed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('Channels and Roles Configuration')
        .setDescription('Server channel and role settings');

      if (displayConfig.channels) {
        const channelsText = Object.entries(displayConfig.channels)
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n');

        channelsRolesEmbed.addFields({
          name: 'Channels',
          value: channelsText || 'None configured',
        });
      }

      if (displayConfig.roles) {
        let rolesText = '';

        if (displayConfig.roles.joinRoles?.length) {
          rolesText += `Join Roles: ${displayConfig.roles.joinRoles.join(', ')}\n`;
        }

        if (displayConfig.roles.levelRoles?.length) {
          rolesText += `Level Roles: ${displayConfig.roles.levelRoles.length} configured\n`;
        }

        if (displayConfig.roles.staffRoles?.length) {
          rolesText += `Staff Roles: ${displayConfig.roles.staffRoles.length} configured\n`;
        }

        if (displayConfig.roles.factPingRole) {
          rolesText += `Fact Ping Role: ${displayConfig.roles.factPingRole}`;
        }

        channelsRolesEmbed.addFields({
          name: 'Roles',
          value: rolesText || 'None configured',
        });
      }

      pages.push(channelsRolesEmbed);
    }

    if (
      displayConfig.leveling ||
      displayConfig.counting ||
      displayConfig.giveaways
    ) {
      const featuresEmbed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('Feature Configurations')
        .setDescription('Settings for bot features');

      if (displayConfig.leveling) {
        featuresEmbed.addFields({
          name: 'Leveling',
          value: `XP Cooldown: ${displayConfig.leveling.xpCooldown}s\nMin XP: ${displayConfig.leveling.minXpAwarded}\nMax XP: ${displayConfig.leveling.maxXpAwarded}`,
        });
      }

      if (displayConfig.counting) {
        const countingText = Object.entries(displayConfig.counting)
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n');

        featuresEmbed.addFields({
          name: 'Counting',
          value: countingText || 'Default settings',
        });
      }

      if (displayConfig.giveaways) {
        const giveawaysText = Object.entries(displayConfig.giveaways)
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n');

        featuresEmbed.addFields({
          name: 'Giveaways',
          value: giveawaysText || 'Default settings',
        });
      }

      pages.push(featuresEmbed);
    }

    let currentPage = 0;

    const components =
      pages.length > 1
        ? [createPaginationButtons(pages.length, currentPage)]
        : [];

    const reply = await interaction.editReply({
      embeds: [pages[currentPage]],
      components,
    });

    if (pages.length <= 1) return;

    const collector = reply.createMessageComponentCollector({
      time: 60000,
    });

    collector.on('collect', async (i) => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({
          content: 'You cannot use these buttons.',
          flags: ['Ephemeral'],
        });
        return;
      }

      switch (i.customId) {
        case 'first':
          currentPage = 0;
          break;
        case 'prev':
          if (currentPage > 0) currentPage--;
          break;
        case 'next':
          if (currentPage < pages.length - 1) currentPage++;
          break;
        case 'last':
          currentPage = pages.length - 1;
          break;
      }

      await i.update({
        embeds: [pages[currentPage]],
        components: [createPaginationButtons(pages.length, currentPage)],
      });
    });

    collector.on('end', async () => {
      await safeRemoveComponents(reply).catch(() => null);
    });
  },
};

export default command;
