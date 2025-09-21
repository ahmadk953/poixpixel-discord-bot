import { Client, Guild, GuildMember } from 'discord.js';
import { loadConfig } from './configLoader.js';

/**
 * Types of notifications that can be sent
 */
export enum NotificationType {
  // Redis notifications
  REDIS_CONNECTION_LOST = 'REDIS_CONNECTION_LOST',
  REDIS_CONNECTION_RESTORED = 'REDIS_CONNECTION_RESTORED',
  REDIS_CACHE_FLUSHED = 'REDIS_CACHE_FLUSHED',

  // Database notifications
  DATABASE_CONNECTION_LOST = 'DATABASE_CONNECTION_LOST',
  DATABASE_CONNECTION_RESTORED = 'DATABASE_CONNECTION_RESTORED',

  // Bot notifications
  BOT_RESTARTING = 'BOT_RESTARTING',
  BOT_ERROR = 'BOT_ERROR',
}

/**
 * Maps notification types to their messages
 */
const NOTIFICATION_MESSAGES = {
  [NotificationType.REDIS_CONNECTION_LOST]:
    '⚠️ **Redis Connection Lost**\n\nThe bot has lost connection to Redis after multiple retry attempts. Caching functionality is disabled until the connection is restored.',
  [NotificationType.REDIS_CONNECTION_RESTORED]:
    '✅ **Redis Connection Restored**\n\nThe bot has successfully reconnected to Redis. All caching functionality has been restored.',

  [NotificationType.REDIS_CACHE_FLUSHED]:
    '✅ **Redis Cache Flushed**\n\nThe bot has successfully flushed the Redis cache.',

  [NotificationType.DATABASE_CONNECTION_LOST]:
    '🚨 **Database Connection Lost**\n\nThe bot has lost connection to the database after multiple retry attempts. The bot cannot function properly without database access and will shut down.',
  [NotificationType.DATABASE_CONNECTION_RESTORED]:
    '✅ **Database Connection Restored**\n\nThe bot has successfully reconnected to the database.',

  [NotificationType.BOT_RESTARTING]:
    '🔄 **Bot Restarting**\n\nThe bot is being restarted. Services will be temporarily unavailable.',
  [NotificationType.BOT_ERROR]:
    '🚨 **Critical Bot Error**\n\nThe bot has encountered a critical error and may not function correctly.',
};

/**
 * Creates a Discord-friendly timestamp string
 * @returns Formatted Discord timestamp string
 */
function createDiscordTimestamp(): string {
  const timestamp = Math.floor(Date.now() / 1000);
  return `<t:${timestamp}:F> (<t:${timestamp}:R>)`;
}

/**
 * Gets all managers with the Manager role
 * @param guild - The guild to search in
 * @returns Array of members with the Manager role
 */
async function getManagers(guild: Guild): Promise<GuildMember[]> {
  const config = loadConfig();
  const managerRoleId = config.roles?.staffRoles?.find(
    (role) => role.name === 'Manager',
  )?.roleId;

  if (!managerRoleId) {
    console.warn('Manager role not found in config');
    return [];
  }

  try {
    await guild.members.fetch();

    return Array.from(
      guild.members.cache
        .filter(
          (member) => member.roles.cache.has(managerRoleId) && !member.user.bot,
        )
        .values(),
    );
  } catch (error) {
    console.error('Error fetching managers:', error);
    return [];
  }
}

/**
 * Sends a notification to users with the Manager role
 * @param client - Discord client instance
 * @param type - Type of notification to send
 * @param customMessage - Optional custom message to append
 */
export async function notifyManagers(
  client: Client,
  type: NotificationType,
  customMessage?: string,
): Promise<void> {
  try {
    const config = loadConfig();
    const guild = client.guilds.cache.get(config.guildId);

    if (!guild) {
      console.error(`Guild with ID ${config.guildId} not found`);
      return;
    }

    const managers = await getManagers(guild);

    if (managers.length === 0) {
      console.warn('No managers found to notify');
      return;
    }

    const baseMessage = NOTIFICATION_MESSAGES[type];
    const timestamp = createDiscordTimestamp();
    const fullMessage = customMessage
      ? `${baseMessage}\n\n${customMessage}`
      : baseMessage;

    let successCount = 0;
    for (const manager of managers) {
      try {
        await manager.send({
          content: `${fullMessage}\n\nTimestamp: ${timestamp}`,
        });
        successCount++;
      } catch (error) {
        console.error(
          `Failed to send DM to manager ${manager.user.tag}:`,
          error,
        );
      }
    }

    console.log(
      `Sent ${type} notification to ${successCount}/${managers.length} managers`,
    );
  } catch (error) {
    console.error('Error sending manager notifications:', error);
  }
}

/**
 * Log a manager-level notification to the console
 * @param type - Type of notification
 * @param details - Additional details
 */
export function logManagerNotification(
  type: NotificationType,
  details?: string,
): void {
  const baseMessage = NOTIFICATION_MESSAGES[type].split('\n')[0];
  console.warn(
    `MANAGER NOTIFICATION: ${baseMessage}${details ? ` | ${details}` : ''}`,
  );
}
