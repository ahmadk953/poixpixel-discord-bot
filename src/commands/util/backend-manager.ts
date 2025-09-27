import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  CommandInteraction,
  ComponentType,
  EmbedBuilder,
  Message,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';

import { SubcommandCommand } from '@/types/CommandTypes.js';
import { initializeDatabaseConnection, ensureDbInitialized } from '@/db/db.js';
import { isRedisConnected } from '@/db/redis.js';
import {
  NotificationType,
  notifyManagers,
} from '@/util/notificationHandler.js';
import { safeRemoveComponents } from '@/util/helpers.js';

const command: SubcommandCommand = {
  data: new SlashCommandBuilder()
    .setName('backend-manager')
    .setDescription('Manage backend services (Postgres database, Redis cache)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('database')
        .setDescription('Force reconnection to the Postgres database'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('redis')
        .setDescription('Force reconnection to Redis cache'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('status')
        .setDescription(
          'Check connection status of the Postgres database and Redis cache',
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('flush')
        .setDescription('(Administrator Only) Flush the Redis cache'),
    ),

  execute: async (interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    await interaction.deferReply({ flags: ['Ephemeral'] });

    const subcommand = interaction.options.getSubcommand();

    if (
      subcommand === 'flush' &&
      !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
    ) {
      await interaction.editReply({
        content: 'You need administrator permissions to flush the Redis cache.',
      });
      return;
    }

    try {
      if (subcommand === 'database') {
        await handleDatabaseReconnect(interaction);
      } else if (subcommand === 'redis') {
        await handleRedisReconnect(interaction);
      } else if (subcommand === 'status') {
        await handleStatusCheck(interaction);
      } else if (subcommand === 'flush') {
        await handleFlushCache(interaction);
      }
    } catch (error) {
      console.error(`Error in reconnect command (${subcommand}):`, error);
      await interaction.editReply({
        content: `An error occurred while processing the reconnect command: \`${error}\``,
      });
    }
  },
};

/**
 * Handle database reconnection
 */
async function handleDatabaseReconnect(interaction: CommandInteraction) {
  await interaction.editReply('Attempting to reconnect to the database...');

  try {
    const success = await initializeDatabaseConnection();

    if (success) {
      await interaction.editReply(
        '✅ **Database reconnection successful!** All database functions should now be operational.',
      );

      notifyManagers(
        interaction.client,
        NotificationType.DATABASE_CONNECTION_RESTORED,
        `Database connection manually restored by ${interaction.user.tag}`,
      );
    } else {
      await interaction.editReply(
        '❌ **Database reconnection failed.** Check the logs for more details.',
      );
    }
  } catch (error) {
    console.error('Error reconnecting to database:', error);
    await interaction.editReply(
      `❌ **Database reconnection failed with error:** \`${error}\``,
    );
  }
}

/**
 * Handle Redis reconnection
 */
async function handleRedisReconnect(interaction: CommandInteraction) {
  await interaction.editReply('Attempting to reconnect to Redis...');

  try {
    const redisModule = await import('@/db/redis.js');

    await redisModule.ensureRedisConnection();

    const isConnected = redisModule.isRedisConnected();

    if (isConnected) {
      await interaction.editReply(
        '✅ **Redis reconnection successful!** Cache functionality is now available.',
      );

      notifyManagers(
        interaction.client,
        NotificationType.REDIS_CONNECTION_RESTORED,
        `Redis connection manually restored by ${interaction.user.tag}`,
      );
    } else {
      await interaction.editReply(
        '❌ **Redis reconnection failed.** The bot will continue to function without caching capabilities.',
      );
    }
  } catch (error) {
    console.error('Error reconnecting to Redis:', error);
    await interaction.editReply(
      `❌ **Redis reconnection failed with error:** \`${error}\``,
    );
  }
}

/**
 * Handle status check of database and Redis
 * @param interaction CommandInteraction
 */
async function handleStatusCheck(interaction: CommandInteraction) {
  await interaction.editReply('Checking connection status...');

  try {
    const dbStatus = await (async () => {
      try {
        await ensureDbInitialized();
        return true;
      } catch {
        return false;
      }
    })();

    const redisStatus = isRedisConnected();

    const statusEmbed = new EmbedBuilder()
      .setTitle('🔌 Service Connection Status')
      .addFields([
        {
          name: 'Database',
          value: dbStatus ? '✅ Connected' : '❌ Disconnected',
          inline: true,
        },
        {
          name: 'Redis Cache',
          value: redisStatus
            ? '✅ Connected'
            : '⚠️ Disconnected (caching disabled)',
          inline: true,
        },
      ])
      .setColor(
        dbStatus && redisStatus ? 0x00ff00 : dbStatus ? 0xffaa00 : 0xff0000,
      )
      .setTimestamp(new Date());

    await interaction.editReply({ content: '', embeds: [statusEmbed] });
  } catch (error) {
    console.error('Error checking connection status:', error);
    await interaction.editReply(
      `❌ **Error checking connection status:** \`${error}\``,
    );
  }
}

/**
 * Handle Redis cache flushing
 */
async function handleFlushCache(interaction: CommandInteraction) {
  // Ask for confirmation first
  const confirmEmbed = new EmbedBuilder()
    .setTitle('⚠️ Confirm Redis Cache Flush')
    .setDescription(
      'This will flush the Redis cache (most keys). The counting data will be preserved. This action is irreversible. Do you want to continue?',
    )
    .setColor(0xffaa00)
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('confirm_flush')
      .setLabel('Confirm Flush')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('cancel_flush')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary),
  );

  await interaction.editReply({ embeds: [confirmEmbed], components: [row] });

  const replyMessage = (await interaction.fetchReply()) as Message<boolean>;

  const collector = replyMessage.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 60000,
  });

  let handled = false;

  collector.on('collect', async (i: ButtonInteraction) => {
    if (i.user.id !== interaction.user.id) {
      await i.reply({
        content: 'These controls are not for you!',
        flags: ['Ephemeral'],
      });
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
          const redisModule = await import('@/db/redis.js');
          await redisModule.flushRedisCache();

          await interaction.editReply(
            '✅ **Redis cache flushed successfully!**',
          );

          notifyManagers(
            interaction.client,
            NotificationType.REDIS_CACHE_FLUSHED,
            `Redis cache manually flushed by ${interaction.user.tag}`,
          );
        } catch (err) {
          console.error('Error flushing Redis cache:', err);
          await interaction.editReply(
            `❌ **Redis cache flush failed with error:** \`${err}\``,
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
    } catch (err) {
      console.error('Error handling confirmation buttons:', err);
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
      await interaction.editReply(
        '⌛ **No response received. Redis cache flush timed out.**',
      );
    }
  });
}

export default command;
