import { and, eq } from 'drizzle-orm';

import {
  db,
  ensureDbInitialized,
  handleDbError,
  invalidateCache,
  withCache,
} from '../db.js';
import * as schema from '../schema.js';

/**
 * Get all achievement definitions
 * @returns Array of achievement definitions
 */
export async function getAllAchievements(): Promise<
  schema.achievementDefinitionsTableTypes[]
> {
  try {
    await ensureDbInitialized();
    if (!db) {
      console.error('Database not initialized, cannot get achievements');
      return [];
    }

    const achievementDefinitions = await withCache(
      'achievementDefinitions',
      async () => {
        return await db
          .select()
          .from(schema.achievementDefinitionsTable)
          .orderBy(schema.achievementDefinitionsTable.threshold);
      },
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
  userId: string,
): Promise<schema.userAchievementsTableTypes[]> {
  try {
    await ensureDbInitialized();
    if (!db) {
      console.error('Database not initialized, cannot get user achievements');
      return [];
    }

    const cachedUserAchievements = await withCache(
      `userAchievements:${userId}`,
      async () => {
        return await db
          .select({
            id: schema.userAchievementsTable.id,
            discordId: schema.userAchievementsTable.discordId,
            achievementId: schema.userAchievementsTable.achievementId,
            earnedAt: schema.userAchievementsTable.earnedAt,
            progress: schema.userAchievementsTable.progress,
          })
          .from(schema.userAchievementsTable)
          .where(eq(schema.userAchievementsTable.discordId, userId));
      },
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
  progress: number,
): Promise<boolean> {
  try {
    await ensureDbInitialized();
    if (!db) {
      console.error(
        'Database not initialized, cannot update achievement progress',
      );
      return false;
    }

    const normalized = Number.isFinite(progress) ? Number(progress) : 0;
    const safeProgress = Math.max(0, Math.min(100, Math.floor(normalized)));

    const existing = await db
      .select()
      .from(schema.userAchievementsTable)
      .where(
        and(
          eq(schema.userAchievementsTable.discordId, userId),
          eq(schema.userAchievementsTable.achievementId, achievementId),
        ),
      )
      .then((rows) => rows[0]);

    if (existing) {
      await db.transaction(async (tx) => {
        const row = await tx
          .select()
          .from(schema.userAchievementsTable)
          .where(eq(schema.userAchievementsTable.id, existing.id))
          .then((rows) => rows[0]);

        const prevProgress = Number(row?.progress ?? 0);
        const updateFields: Partial<typeof row> = {
          progress: safeProgress,
        };

        if (prevProgress < 100 && safeProgress >= 100 && !row?.earnedAt) {
          updateFields.earnedAt = new Date();
        }

        await tx
          .update(schema.userAchievementsTable)
          .set(updateFields)
          .where(eq(schema.userAchievementsTable.id, existing.id));
      });
    } else {
      await db.insert(schema.userAchievementsTable).values({
        discordId: userId,
        achievementId,
        progress: safeProgress,
        earnedAt: safeProgress >= 100 ? new Date() : null,
      });
    }

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
  requirement?: any;
  rewardType?: string;
  rewardValue?: string;
}): Promise<schema.achievementDefinitionsTableTypes | undefined> {
  try {
    await ensureDbInitialized();
    if (!db) {
      console.error('Database not initialized, cannot create achievement');
      return undefined;
    }

    const [achievement] = await db
      .insert(schema.achievementDefinitionsTable)
      .values({
        name: achievementData.name,
        description: achievementData.description,
        imageUrl: achievementData.imageUrl || null,
        requirementType: achievementData.requirementType,
        threshold: achievementData.threshold,
        requirement: achievementData.requirement || {},
        rewardType: achievementData.rewardType || null,
        rewardValue: achievementData.rewardValue || null,
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
  achievementId: number,
): Promise<boolean> {
  try {
    await ensureDbInitialized();
    if (!db) {
      console.error('Database not initialized, cannot delete achievement');
      return false;
    }

    await db
      .delete(schema.userAchievementsTable)
      .where(eq(schema.userAchievementsTable.achievementId, achievementId));

    await db
      .delete(schema.achievementDefinitionsTable)
      .where(eq(schema.achievementDefinitionsTable.id, achievementId));

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
  achievementId: number,
): Promise<boolean> {
  try {
    await ensureDbInitialized();
    if (!db) {
      console.error('Database not initialized, cannot remove user achievement');
      return false;
    }

    await db
      .delete(schema.userAchievementsTable)
      .where(
        and(
          eq(schema.userAchievementsTable.discordId, discordId),
          eq(schema.userAchievementsTable.achievementId, achievementId),
        ),
      );

    await invalidateCache(`userAchievements:${discordId}`);

    return true;
  } catch (error) {
    handleDbError('Failed to remove user achievement', error as Error);
    return false;
  }
}
