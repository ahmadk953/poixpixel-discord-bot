import {
  CommandInteraction,
  PermissionsBitField,
  SlashCommandBuilder,
} from 'discord.js';

import { SubcommandCommand } from '@/types/CommandTypes.js';
import { loadConfig } from '@/util/configLoader.js';
import { initializeDatabaseConnection, ensureDbInitialized } from '@/db/db.js';
import { isRedisConnected } from '@/db/redis.js';
import {
  NotificationType,
  notifyManagers,
} from '@/util/notificationHandler.js';

const command: SubcommandCommand = {
  data: new SlashCommandBuilder()
    .setName('backend-manager')
    .setDescription('(Manager Only) Force reconnection to database or Redis')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('database')
        .setDescription('(Manager Only) Force reconnection to the database'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('redis')
        .setDescription('(Manager Only) Force reconnection to Redis cache'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('status')
        .setDescription(
          '(Manager Only) Check connection status of database and Redis',
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

    const config = loadConfig();
    const managerRoleId = config.roles.staffRoles.find(
      (role) => role.name === 'Manager',
    )?.roleId;

    const member = await interaction.guild?.members.fetch(interaction.user.id);
    const hasManagerRole = member?.roles.cache.has(managerRoleId || '');

    if (
      !hasManagerRole &&
      !interaction.memberPermissions?.has(
        PermissionsBitField.Flags.Administrator,
      )
    ) {
      await interaction.editReply({
        content:
          'You do not have permission to use this command. This command is restricted to users with the Manager role or administrator permissions.',
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

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
 * Handle status check for both services
 */
async function handleStatusCheck(interaction: any) {
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

    const statusEmbed = {
      title: '🔌 Service Connection Status',
      fields: [
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
      ],
      color:
        dbStatus && redisStatus ? 0x00ff00 : dbStatus ? 0xffaa00 : 0xff0000,
      timestamp: new Date().toISOString(),
    };

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
  await interaction.editReply('Flushing Redis cache...');

  try {
    const redisModule = await import('@/db/redis.js');

    await redisModule.flushRedisCache();

    await interaction.editReply('✅ **Redis cache flushed successfully!**');

    notifyManagers(
      interaction.client,
      NotificationType.REDIS_CACHE_FLUSHED,
      `Redis cache manually flushed by ${interaction.user.tag}`,
    );
  } catch (error) {
    console.error('Error flushing Redis cache:', error);
    await interaction.editReply(
      `❌ **Redis cache flush failed with error:** \`${error}\``,
    );
  }
}

export default command;
