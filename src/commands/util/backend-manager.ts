import { performance } from 'node:perf_hooks';

import {
  ActionRowBuilder,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  type ChatInputCommandInteraction,
  ComponentType,
  EmbedBuilder,
  type Message,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';

import { ensureDbInitialized, initializeDatabaseConnection } from '@/db/db.js';
import {
  ensureRedisConnection,
  exists,
  flushRedisCache,
  isRedisConnected,
} from '@/db/redis.js';
import type { SubcommandCommand } from '@/types/CommandTypes.js';
import {
  safelyRespond,
  safeRemoveComponents,
  validateInteraction,
} from '@/util/helpers.js';
import { logger } from '@/util/logger.js';
import {
  NotificationType,
  notifyManagers,
} from '@/util/notificationHandler.js';

interface ConnectionStatus {
  connected: boolean;
  latencyLabel: string;
}

const command: SubcommandCommand = {
  data: new SlashCommandBuilder()
    .setName('backend-manager')
    .setDescription('Manage backend services (Postgres database, Redis cache)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('database')
        .setDescription('Force reconnection to the Postgres database')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('redis')
        .setDescription('Force reconnection to Redis cache')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('status')
        .setDescription(
          'Check connection status of the Postgres database and Redis cache'
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('flush')
        .setDescription('(Administrator Only) Flush the Redis cache')
    ),

  execute: async (interaction) => {
    if (!(await validateInteraction(interaction))) {
      await safelyRespond(interaction, 'Invalid interaction.', true);
      return;
    }

    await interaction.deferReply({ flags: ['Ephemeral'] });

    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'database':
          await handleDatabaseReconnect(interaction);
          break;
        case 'redis':
          await handleRedisReconnect(interaction);
          break;
        case 'status':
          await handleStatusCheck(interaction);
          break;
        case 'flush':
          if (
            !interaction.memberPermissions?.has(
              PermissionFlagsBits.Administrator
            )
          ) {
            await safelyRespond(
              interaction,
              'You need administrator permissions to flush the Redis cache.'
            );
            return;
          }
          await handleFlushCache(interaction);
          break;
        default:
          await safelyRespond(
            interaction,
            `Unknown subcommand: \`${subcommand}\``
          );
          break;
      }
    } catch (error) {
      logger.error(
        `[BackendManagerCommand] Error in reconnect command (${subcommand})`,
        error
      );
      await safelyRespond(
        interaction,
        `An error occurred while processing the reconnect command: \`${error}\``
      );
    }
  },
};

/**
 * Handle database reconnection
 */
async function handleDatabaseReconnect(
  interaction: ChatInputCommandInteraction
) {
  await safelyRespond(
    interaction,
    'Attempting to reconnect to the database...',
    true
  );

  try {
    const success = await initializeDatabaseConnection();

    if (success) {
      await safelyRespond(
        interaction,
        '✅ **Database reconnection successful!** All database functions should now be operational.'
      );

      notifyManagers(
        interaction.client,
        NotificationType.DATABASE_CONNECTION_RESTORED,
        `Database connection manually restored by ${interaction.user.tag}`
      );
    } else {
      await safelyRespond(
        interaction,
        '❌ **Database reconnection failed.** Check the logs for more details.'
      );
    }
  } catch (error) {
    logger.error(
      '[BackendManagerCommand] Error reconnecting to database',
      error
    );
    await safelyRespond(
      interaction,
      `❌ **Database reconnection failed with error:** \`${error}\``
    );
  }
}

/**
 * Handle Redis reconnection
 */
async function handleRedisReconnect(interaction: ChatInputCommandInteraction) {
  await safelyRespond(interaction, 'Attempting to reconnect to Redis...');

  try {
    ensureRedisConnection();

    const connected = isRedisConnected();

    if (connected) {
      await safelyRespond(
        interaction,
        '✅ **Redis reconnection successful!** Cache functionality is now available.'
      );

      notifyManagers(
        interaction.client,
        NotificationType.REDIS_CONNECTION_RESTORED,
        `Redis connection manually restored by ${interaction.user.tag}`
      );
    } else {
      await safelyRespond(
        interaction,
        '❌ **Redis reconnection failed.** The bot will continue to function without caching capabilities.'
      );
    }
  } catch (error) {
    logger.error('[BackendManagerCommand] Error reconnecting to Redis', error);
    await safelyRespond(
      interaction,
      `❌ **Redis reconnection failed with error:** \`${error}\``
    );
  }
}

/**
 * Handle status check of database and Redis
 * @param interaction ChatInputCommandInteraction
 */
async function handleStatusCheck(interaction: ChatInputCommandInteraction) {
  await safelyRespond(interaction, 'Checking connection status...');

  try {
    const [dbStatus, redisStatus] = await Promise.all([
      measureConnectionStatus(async () => {
        await ensureDbInitialized();
      }),
      measureConnectionStatus(async () => {
        if (!isRedisConnected()) {
          throw new Error('Redis is not connected');
        }

        await exists('backend-manager:status-probe');
      }),
    ]);

    let statusColor: number;
    if (dbStatus.connected && redisStatus.connected) {
      statusColor = 0x00_ff_00;
    } else if (dbStatus.connected) {
      statusColor = 0xff_aa_00;
    } else {
      statusColor = 0xff_00_00;
    }

    const statusEmbed = new EmbedBuilder()
      .setTitle('🔌 Service Connection Status')
      .addFields([
        {
          name: 'Database',
          value: dbStatus.connected
            ? `✅ Connected (${dbStatus.latencyLabel})`
            : '❌ Disconnected',
          inline: true,
        },
        {
          name: 'Redis Cache',
          value: redisStatus.connected
            ? `✅ Connected (${redisStatus.latencyLabel})`
            : '⚠️ Disconnected (caching disabled)',
          inline: true,
        },
      ])
      .setColor(statusColor)
      .setTimestamp(new Date());

    await interaction.editReply({ embeds: [statusEmbed] });
  } catch (error) {
    logger.error(
      '[BackendManagerCommand] Error checking connection status',
      error
    );
    await safelyRespond(
      interaction,
      `❌ **Error checking connection status:** \`${error}\``
    );
  }
}

async function measureConnectionStatus(
  check: () => Promise<void>
): Promise<ConnectionStatus> {
  try {
    const startedAt = performance.now();
    await check();
    const elapsedMs = Math.max(0, Math.round(performance.now() - startedAt));

    return { connected: true, latencyLabel: `${elapsedMs}ms` };
  } catch {
    return { connected: false, latencyLabel: 'unavailable' };
  }
}

/**
 * Handle Redis cache flushing
 */
async function handleFlushCache(interaction: ChatInputCommandInteraction) {
  // Ask for confirmation first
  const confirmEmbed = new EmbedBuilder()
    .setTitle('⚠️ Confirm Redis Cache Flush')
    .setDescription(
      'This will flush the Redis cache (most keys). The counting data will be preserved. This action is irreversible. Do you want to continue?'
    )
    .setColor(0xff_aa_00)
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('confirm_flush')
      .setLabel('Confirm Flush')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('cancel_flush')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.editReply({ embeds: [confirmEmbed], components: [row] });

  const replyMessage = (await interaction.fetchReply()) as Message<boolean>;

  const collector = replyMessage.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 60_000,
  });

  let handled = false;

  collector.on('collect', async (i: ButtonInteraction) => {
    if (i.user.id !== interaction.user.id) {
      if (await validateInteraction(i)) {
        await safelyRespond(i, 'These controls are not for you!', true);
      }
      return;
    }

    try {
      if (i.customId === 'confirm_flush') {
        handled = true;
        await i.update({
          content: 'Flushing Redis cache...',
          embeds: [],
          components: [],
        });

        try {
          await flushRedisCache();

          await safelyRespond(
            interaction,
            '✅ **Redis cache flushed successfully!**'
          );

          notifyManagers(
            interaction.client,
            NotificationType.REDIS_CACHE_FLUSHED,
            `Redis cache manually flushed by ${interaction.user.tag}`
          );
        } catch (error) {
          logger.error(
            '[BackendManagerCommand] Error flushing Redis cache',
            error
          );
          await safelyRespond(
            interaction,
            `❌ **Redis cache flush failed with error:** \`${error}\``
          );
        }
      } else if (i.customId === 'cancel_flush') {
        handled = true;
        await i.update({
          content: '❎ **Redis cache flush cancelled.**',
          embeds: [],
          components: [],
        });
      }
    } catch (error) {
      logger.error(
        '[BackendManagerCommand] Error handling confirmation buttons',
        error
      );
    } finally {
      try {
        collector.stop();
      } catch {
        // ignore stop errors
      }
    }
  });

  collector.on('end', async () => {
    await safeRemoveComponents(replyMessage).catch(() => null);
    if (!handled) {
      await safelyRespond(
        interaction,
        '⌛ **No response received. Redis cache flush timed out.**'
      );
    }
  });
}

export default command;
