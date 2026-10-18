import type { Message } from 'discord.js';
import { inArray, type SQL, sql } from 'drizzle-orm';

import {
  addXpToUser,
  db,
  getUserLevel,
  handleDbError,
  invalidateCache,
} from '@/db/db.js';
import { invalidateLeaderboardCache } from '@/db/functions/levelFunctions.js';
import { levelTable, type levelTableTypes } from '@/db/schema.js';
import { processMessageAchievements } from '../achievementManager.js';
import { logger } from '../logger.js';
import {
  DEFAULT_BATCH_SIZE,
  MAX_XP,
  MIN_XP,
  XP_COOLDOWN,
} from './constants.js';
import { calculateLevelFromXp } from './xpCalculations.js';

// biome-ignore lint/performance/noBarrelFile: This file serves as the main export for all leveling system functions
export {
  DEFAULT_BATCH_SIZE,
  MAX_XP,
  MIN_XP,
  XP_COOLDOWN,
} from './constants.js';
export { checkAndAssignLevelRoles } from './levelRoles.js';
export { generateRankCard } from './rankCard.js';
export {
  calculateLevelFromXp,
  calculateXpForLevel,
  getXpToNextLevel,
} from './xpCalculations.js';

export interface RecalculationResult {
  levelDown: number;
  leveledUp: number;
  noChange: number;
  totalUsers: number;
  updated: number;
}

/**
 * Invalidates the leaderboard and per-user level caches after recalculation
 * @param changedDiscordIds - Users whose levels changed
 */
async function invalidateRecalculatedCaches(
  changedDiscordIds: string[]
): Promise<void> {
  await invalidateLeaderboardCache();
  await Promise.all(
    changedDiscordIds.map((discordId) =>
      invalidateCache(`userLevels:${discordId}`)
    )
  );
}

/**
 * Applies level changes for a single batch and returns changed user IDs
 * @param batch - Users in the batch
 * @param result - Statistics accumulator updated in place
 * @returns - Discord IDs of users whose level changed
 */
async function applyBatchLevelChanges(
  batch: levelTableTypes[],
  result: RecalculationResult
): Promise<string[]> {
  const currentLevels = new Map(batch.map((u) => [u.discordId, u.level]));
  const newLevels = batch.map((u) => ({
    discordId: u.discordId,
    newXp: u.xp,
    newLevel: calculateLevelFromXp(u.xp),
  }));

  const levelsToChange = newLevels.filter(
    (u) => u.newLevel !== currentLevels.get(u.discordId)
  );

  if (levelsToChange.length > 0) {
    const changeChunks: SQL[] = [];

    changeChunks.push(sql`(case`);

    for (const user of levelsToChange) {
      changeChunks.push(
        sql`when ${levelTable.discordId} = ${user.discordId} then ${user.newLevel}`
      );
    }

    changeChunks.push(sql`end)`);
    const finalSql = sql.join(changeChunks, sql.raw(' '));

    await db
      .update(levelTable)
      .set({ level: finalSql })
      .where(
        inArray(
          levelTable.discordId,
          levelsToChange.map((u) => u.discordId)
        )
      );

    result.updated += levelsToChange.length;
    result.leveledUp += levelsToChange.filter(
      (u) => u.newLevel > (currentLevels.get(u.discordId) ?? 0)
    ).length;
    result.levelDown += levelsToChange.filter(
      (u) => u.newLevel < (currentLevels.get(u.discordId) ?? 0)
    ).length;
  }

  result.noChange += batch.length - levelsToChange.length;

  return levelsToChange.map((u) => u.discordId);
}

/**
 * Recalculates the levels for all users in the database
 * @param batchSize - Number of users to process in each batch (default: 200)
 * @returns - Statistics about the recalculation
 */
export async function recalculateUserLevels(batchSize = DEFAULT_BATCH_SIZE) {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error(
      `Invalid batchSize: ${batchSize}. Must be a positive integer.`
    );
  }

  const result: RecalculationResult = {
    totalUsers: 0,
    updated: 0,
    leveledUp: 0,
    levelDown: 0,
    noChange: 0,
  };

  const changedDiscordIds: string[] = [];
  let success = false;

  try {
    const allUsers = await db.select().from(levelTable);
    result.totalUsers = allUsers.length;

    for (let i = 0; i < allUsers.length; i += batchSize) {
      const batch = allUsers.slice(i, i + batchSize);
      const changedIds = await applyBatchLevelChanges(batch, result);
      for (const discordId of changedIds) {
        changedDiscordIds.push(discordId);
      }
    }

    success = true;
  } catch (error) {
    handleDbError('Failed to recalculate user levels', error as Error);
  }

  if (success) {
    try {
      await invalidateRecalculatedCaches(changedDiscordIds);
    } catch (error) {
      logger.verbose('[RecalculateLevels] Failed to invalidate caches', error);
    }
  }

  return result;
}

const SAFETY_XP_CAP = 100;

/**
 * Processes a message for XP
 * @param message - The message to process for XP
 * @returns - The result of processing the message
 */
export async function processMessage(message: Message) {
  if (message.author.bot || !message.guild) {
    return;
  }

  try {
    const userId = message.author.id;
    const userData = await getUserLevel(userId);

    if (userData.lastMessageTimestamp) {
      const lastMessageTime = new Date(userData.lastMessageTimestamp).getTime();
      const currentTime = Date.now();

      if (currentTime - lastMessageTime < XP_COOLDOWN) {
        return null;
      }
    }

    let xpToAdd = Math.floor(Math.random() * (MAX_XP - MIN_XP + 1)) + MIN_XP;

    if (xpToAdd > SAFETY_XP_CAP) {
      logger.verbose(
        `[LevelingManager] Unusually large XP amount generated: ${xpToAdd}. Capping at ${SAFETY_XP_CAP}.`
      );
      xpToAdd = SAFETY_XP_CAP;
    }

    const result = await addXpToUser(userId, xpToAdd);

    await processMessageAchievements(message);
    return result;
  } catch (error) {
    logger.error('[LevelingManager] Error processing message for XP', error);
    return null;
  }
}
