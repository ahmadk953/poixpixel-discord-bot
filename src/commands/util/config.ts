import type {
  ChatInputCommandInteraction,
  Message,
  MessageComponentInteraction,
} from 'discord.js';
import {
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';

import type { Command } from '@/types/CommandTypes.js';
import { getConfigLoadTime, loadConfig } from '@/util/configLoader.js';
import {
  createPaginationButtons,
  safelyRespond,
  safeRemoveComponents,
  validateInteraction,
} from '@/util/helpers.js';

type Config = ReturnType<typeof loadConfig>;

const redactSecrets = (config: Config): Config => {
  const output = JSON.parse(JSON.stringify(config)) as Config;

  if (output.token) {
    output.token = '••••••••••••••••••••••••••';
  }

  if (output.database) {
    if (output.database.poolingDbConnectionString) {
      output.database.poolingDbConnectionString = '••••••••••••••••••••••••••';
    } else if (output.database.directDbConnectionString) {
      output.database.directDbConnectionString = '••••••••••••••••••••••••••';
    }
  }

  if (output.redis?.redisConnectionString) {
    output.redis.redisConnectionString = '••••••••••••••••••••••••••';
  }

  return output;
};

const buildBasicConfigEmbed = (
  displayConfig: Config,
  configLoadTime: number | null
) =>
  new EmbedBuilder()
    .setColor(0x00_99_ff)
    .setTitle('Bot Configuration')
    .setDescription(
      `Current configuration settings (sensitive data redacted)\n\n**Last Loaded:** ${
        configLoadTime
          ? `<t:${Math.floor(configLoadTime / 1000)}:R>`
          : 'Unknown'
      }\n**Cache Status:** ✅ In Memory`
    )
    .addFields(
      {
        name: 'Client ID',
        value: displayConfig.clientId ?? 'Not set',
        inline: true,
      },
      {
        name: 'Guild ID',
        value: displayConfig.guildId ?? 'Not set',
        inline: true,
      },
      {
        name: 'Token',
        value: displayConfig.token ?? 'Not set',
        inline: true,
      }
    );

const buildDatabaseRedisEmbed = (
  displayConfig: Config
): EmbedBuilder | null => {
  if (!(displayConfig.database || displayConfig.redis)) {
    return null;
  }

  const embed = new EmbedBuilder()
    .setColor(0x00_99_ff)
    .setTitle('Database and Redis Configuration')
    .setDescription('Database and cache settings');

  if (displayConfig.database) {
    const dbConn =
      displayConfig.database.poolingDbConnectionString ??
      displayConfig.database.directDbConnectionString ??
      'Not set';

    embed.addFields({
      name: 'Database',
      value: `Connection: ${dbConn}\nRetry Attempts: ${displayConfig.database.queryRetryAttempts}\nInitial Retry Delay: ${displayConfig.database.queryRetryInitialDelay}ms`,
    });
  }

  if (displayConfig.redis) {
    embed.addFields({
      name: 'Redis',
      value: `Connection: ${displayConfig.redis.redisConnectionString}\nRetry Attempts: ${displayConfig.redis.retryAttempts}\nInitial Retry Delay: ${displayConfig.redis.initialRetryDelay}ms`,
    });
  }

  return embed;
};

const buildChannelsRolesEmbed = (
  displayConfig: Config
): EmbedBuilder | null => {
  if (!(displayConfig.channels || displayConfig.roles)) {
    return null;
  }

  const embed = new EmbedBuilder()
    .setColor(0x00_99_ff)
    .setTitle('Channels and Roles Configuration')
    .setDescription('Server channel and role settings');

  if (displayConfig.channels) {
    const channelsText = Object.entries(displayConfig.channels)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    const channelsValue =
      channelsText && channelsText.trim() !== ''
        ? channelsText
        : 'None configured';

    embed.addFields({
      name: 'Channels',
      value: channelsValue,
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

    const rolesValue =
      rolesText && rolesText.trim() !== '' ? rolesText : 'None configured';

    embed.addFields({
      name: 'Roles',
      value: rolesValue,
    });
  }

  return embed;
};

const buildFeaturesEmbed = (displayConfig: Config): EmbedBuilder | null => {
  if (!(displayConfig.leveling || displayConfig.counting)) {
    return null;
  }

  const embed = new EmbedBuilder()
    .setColor(0x00_99_ff)
    .setTitle('Feature Configurations')
    .setDescription('Settings for bot features');

  if (displayConfig.leveling) {
    embed.addFields({
      name: 'Leveling',
      value: `XP Cooldown: ${displayConfig.leveling.xpCooldown}s\nMin XP: ${displayConfig.leveling.minXpAwarded}\nMax XP: ${displayConfig.leveling.maxXpAwarded}`,
    });
  }

  if (displayConfig.counting) {
    const countingText = Object.entries(displayConfig.counting)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    const countingValue =
      countingText && countingText.trim() !== ''
        ? countingText
        : 'Default settings';

    embed.addFields({
      name: 'Counting',
      value: countingValue,
    });
  }

  return embed;
};

const buildConfigPages = (
  displayConfig: Config,
  configLoadTime: number | null
) => {
  const pages: EmbedBuilder[] = [];

  pages.push(buildBasicConfigEmbed(displayConfig, configLoadTime));

  const dbRedisEmbed = buildDatabaseRedisEmbed(displayConfig);
  if (dbRedisEmbed) {
    pages.push(dbRedisEmbed);
  }

  const channelsRolesEmbed = buildChannelsRolesEmbed(displayConfig);
  if (channelsRolesEmbed) {
    pages.push(channelsRolesEmbed);
  }

  const featuresEmbed = buildFeaturesEmbed(displayConfig);
  if (featuresEmbed) {
    pages.push(featuresEmbed);
  }

  return pages;
};

const attachPaginationCollector = (
  interaction: ChatInputCommandInteraction,
  message: Message<boolean>,
  pages: EmbedBuilder[]
) => {
  if (pages.length <= 1) {
    return;
  }

  let currentPage = 0;

  const collector = message.createMessageComponentCollector({
    time: 60_000,
  });

  collector.on('collect', async (i: MessageComponentInteraction) => {
    if (i.user.id !== interaction.user.id) {
      await i.reply({
        content: 'You cannot use this pagination.',
        flags: ['Ephemeral'],
      });
      return;
    }

    if (!i.isButton()) {
      return;
    }

    switch (i.customId) {
      case 'first_page':
        currentPage = 0;
        break;
      case 'prev_page':
        currentPage = Math.max(0, currentPage - 1);
        break;
      case 'next_page':
        currentPage = Math.min(pages.length - 1, currentPage + 1);
        break;
      case 'last_page':
        currentPage = pages.length - 1;
        break;
      default:
        break;
    }

    await i.update({
      embeds: [pages[currentPage]],
      components: [createPaginationButtons(pages.length, currentPage)],
    });
  });

  collector.on('end', async () => {
    await safeRemoveComponents(message).catch(() => null);
  });
};

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Display the current configuration')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  execute: async (interaction) => {
    if (!(await validateInteraction(interaction))) {
      await safelyRespond(
        interaction,
        'Invalid interaction. Please try again.',
        true
      );
      return;
    }

    await interaction.deferReply({ flags: ['Ephemeral'] });

    const config = loadConfig();
    const configLoadTime = getConfigLoadTime();
    const displayConfig = redactSecrets(config);
    const pages = buildConfigPages(displayConfig, configLoadTime);

    const components =
      pages.length > 1 ? [createPaginationButtons(pages.length, 0)] : [];

    const message = (await interaction.editReply({
      embeds: [pages[0]],
      components,
    })) as Message<boolean>;

    await attachPaginationCollector(interaction, message, pages);
  },
};

export default command;
