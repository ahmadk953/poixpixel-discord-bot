import { and, eq, sql } from 'drizzle-orm';

import { logger } from '@/util/logger.js';
import {
  db,
  ensureDbInitialized,
  handleDbError,
  invalidateCache,
  withCache,
  withDbRetryDrizzle,
} from '../db.js';
import {
  achievementDefinitionsTable,
  type achievementDefinitionsTableTypes,
  userAchievementsTable,
  type userAchievementsTableTypes,
} from '../schema.js';

/**
 * Get all achievement definitions
 * @returns Array of achievement definitions
 */
export async function getAllAchievements(): Promise<
  achievementDefinitionsTableTypes[]
> {
  try {
    await ensureDbInitialized();
    if (!db) {
      logger.error(
        '[achievementDbFunctions] Database not initialized, cannot get achievements'
      );
      throw new Error('Database not initialized');
    }
    const achievementDefinitions = await withCache(
      'achievementDefinitions',
      async () => {
        return await withDbRetryDrizzle(
          async () => {
            return await db
              .select()
              .from(achievementDefinitionsTable)
              .orderBy(achievementDefinitionsTable.threshold);
          },
          {
            operationName: 'get-all-achievements',
          }
        );
      }
    );

    return achievementDefinitions;
  } catch (error) {
    return handleDbError('Failed to get all achievements', error as Error);
  }
}

/**
 * Get achievements for a specific user
 * @param userId - Discord ID of the user
 * @returns Array of user achievements
 */
export async function getUserAchievements(
  userId: string
): Promise<userAchievementsTableTypes[]> {
  try {
    await ensureDbInitialized();
    if (!db) {
      logger.error(
        '[achievementDbFunctions] Database not initialized, cannot get user achievements'
      );
      throw new Error('Database not initialized');
    }

    const cachedUserAchievements = await withCache(
      `userAchievements:${userId}`,
      async () => {
        return await withDbRetryDrizzle(
          async () => {
            return await db
              .select({
                id: userAchievementsTable.id,
                discordId: userAchievementsTable.discordId,
                achievementId: userAchievementsTable.achievementId,
                earnedAt: userAchievementsTable.earnedAt,
                progress: userAchievementsTable.progress,
              })
              .from(userAchievementsTable)
              .where(eq(userAchievementsTable.discordId, userId));
          },
          {
            operationName: 'get-user-achievements',
          }
        );
      }
    );

    return cachedUserAchievements;
  } catch (error) {
    return handleDbError('Failed to get user achievements', error as Error);
  }
}

/**
 * Update achievement progress for a user
 * @param userId - Discord ID of the user
 * @param achievementId - ID of the achievement
 * @param progress - Progress value (0-100)
 * @returns Boolean indicating success
 */
export async function updateAchievementProgress(
  userId: string,
  achievementId: number,
  progress: number
): Promise<boolean> {
  try {
    await ensureDbInitialized();
    if (!db) {
      logger.error(
        '[achievementDbFunctions] Database not initialized, cannot update achievement progress'
      );
      throw new Error('Database not initialized');
    }

    const normalized = Number.isFinite(progress) ? Number(progress) : 0;
    const safeProgress = Math.max(0, Math.min(100, Math.floor(normalized)));
    const now = new Date();

    await db
      .insert(userAchievementsTable)
      .values({
        discordId: userId,
        achievementId,
        progress: safeProgress,
        earnedAt: safeProgress >= 100 ? now : null,
      })
      .onConflictDoUpdate({
        target: [
          userAchievementsTable.discordId,
          userAchievementsTable.achievementId,
        ],
        set: {
          progress: safeProgress,
          earnedAt: sql`CASE
            WHEN ${safeProgress} >= 100 THEN COALESCE(${userAchievementsTable.earnedAt}, ${now})
            ELSE ${userAchievementsTable.earnedAt}
          END`,
        },
      });

    await invalidateCache(`userAchievements:${userId}`);

    return true;
  } catch (error) {
    handleDbError('Failed to update achievement progress', error as Error);
    return false;
  }
}

/**
 * Create a new achievement definition
 * @param achievementData - Achievement definition data
 * @returns Created achievement or undefined on failure
 */
export async function createAchievement(achievementData: {
  name: string;
  description: string;
  imageUrl?: string;
  requirementType: string;
  threshold: number;
  requirement?: Record<string, unknown>;
  rewardType?: string;
  rewardValue?: string;
}): Promise<achievementDefinitionsTableTypes | undefined> {
  try {
    await ensureDbInitialized();
    if (!db) {
      logger.error(
        '[achievementDbFunctions] Database not initialized, cannot create achievement'
      );
      throw new Error('Database not initialized');
    }

    const [achievement] = await db
      .insert(achievementDefinitionsTable)
      .values({
        name: achievementData.name,
        description: achievementData.description,
        imageUrl: achievementData.imageUrl ?? null,
        requirementType: achievementData.requirementType,
        threshold: achievementData.threshold,
        requirement: achievementData.requirement ?? {},
        rewardType: achievementData.rewardType ?? null,
        rewardValue: achievementData.rewardValue ?? null,
      })
      .returning();

    await invalidateCache('achievementDefinitions');

    return achievement;
  } catch (error) {
    return handleDbError('Failed to create achievement', error as Error);
  }
}

/**
 * Delete an achievement definition
 * @param achievementId - ID of the achievement to delete
 * @returns Boolean indicating success
 */
export async function deleteAchievement(
  achievementId: number
): Promise<boolean> {
  try {
    await ensureDbInitialized();
    if (!db) {
      logger.error(
        '[achievementDbFunctions] Database not initialized, cannot delete achievement'
      );
      throw new Error('Database not initialized');
    }

    await withDbRetryDrizzle(
      async () => {
        return await db
          .delete(userAchievementsTable)
          .where(eq(userAchievementsTable.achievementId, achievementId));
      },
      {
        operationName: 'delete-user-achievements-for-definition',
        forceRetry: true,
      }
    );

    await withDbRetryDrizzle(
      async () => {
        return await db
          .delete(achievementDefinitionsTable)
          .where(eq(achievementDefinitionsTable.id, achievementId));
      },
      {
        operationName: 'delete-achievement-definition',
        forceRetry: true,
      }
    );

    await invalidateCache('achievementDefinitions');

    return true;
  } catch (error) {
    handleDbError('Failed to delete achievement', error as Error);
    return false;
  }
}

/**
 * Removes an achievement from a user
 * @param discordId - Discord user ID
 * @param achievementId - Achievement ID to remove
 * @returns boolean indicating success
 */
export async function removeUserAchievement(
  discordId: string,
  achievementId: number
): Promise<boolean> {
  try {
    await ensureDbInitialized();
    if (!db) {
      logger.error(
        '[achievementDbFunctions] Database not initialized, cannot remove user achievement'
      );
      throw new Error('Database not initialized');
    }

    await withDbRetryDrizzle(
      async () => {
        return await db
          .delete(userAchievementsTable)
          .where(
            and(
              eq(userAchievementsTable.discordId, discordId),
              eq(userAchievementsTable.achievementId, achievementId)
            )
          );
      },
      {
        operationName: 'remove-user-achievement',
        forceRetry: true,
      }
    );

    await invalidateCache(`userAchievements:${discordId}`);

    return true;
  } catch (error) {
    handleDbError('Failed to remove user achievement', error as Error);
    return false;
  }
}

/**
 * Removes all achievements for a user
 * @param discordId - Discord user ID
 */
export async function removeAllUserAchievements(
  discordId: string
): Promise<void> {
  try {
    await ensureDbInitialized();
    if (!db) {
      logger.error(
        '[achievementDbFunctions] Database not initialized, cannot remove user achievements'
      );
      throw new Error('Database not initialized');
    }

    await withDbRetryDrizzle(
      async () => {
        return await db
          .delete(userAchievementsTable)
          .where(eq(userAchievementsTable.discordId, discordId));
      },
      {
        operationName: 'remove-all-user-achievements',
        forceRetry: true,
      }
    );

    await invalidateCache(`userAchievements:${discordId}`);
  } catch (error) {
    handleDbError('Failed to remove all user achievements', error as Error);
  }
}
