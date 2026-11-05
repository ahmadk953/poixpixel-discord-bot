import type { Guild } from 'discord.js';

import { loadConfig } from '../configLoader.js';
import { logger } from '../logger.js';

const config = loadConfig();

/**
 * Assigns level roles to a user based on their new level
 * @param guild - The guild to assign roles in
 * @param userId - The userId of the user to assign roles to
 * @param newLevel - The new level of the user
 * @returns - The highest role that was assigned
 */
export async function checkAndAssignLevelRoles(
  guild: Guild,
  userId: string,
  newLevel: number
) {
  try {
    if (!config.roles.levelRoles || config.roles.levelRoles.length === 0) {
      return;
    }

    const member = await guild.members.fetch(userId);
    if (!member) {
      return;
    }

    const rolesToAdd = config.roles.levelRoles
      .filter((role) => role.level <= newLevel)
      .sort((a, b) => a.level - b.level);

    if (rolesToAdd.length === 0) {
      return;
    }

    const newRolesToAdd = rolesToAdd.filter(
      (role) => !member.roles.cache.has(role.roleId)
    );

    if (newRolesToAdd.length > 0) {
      const roleIdsToAdd = newRolesToAdd.map((r) => r.roleId);
      await member.roles.add(roleIdsToAdd);

      const highestNewRole = newRolesToAdd.at(-1)?.roleId;
      return highestNewRole;
    }

    return;
  } catch (error) {
    logger.error('[LevelingManager] Error assigning level roles', error);
  }
}
