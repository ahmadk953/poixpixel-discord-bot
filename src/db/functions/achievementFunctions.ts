import { and, eq } from 'drizzle-orm';

import { db, ensureDbInitialized, handleDbError } from '../db.js';
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

    return await db
      .select()
      .from(schema.achievementDefinitionsTable)
      .orderBy(schema.achievementDefinitionsTable.threshold);
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
  } catch (error) {
    return handleDbError('Failed to get user achievements', error as Error);
  }
}

/**
 * Award an achievement to a user
 * @param userId - Discord ID of the user
 * @param achievementId - ID of the achievement
 * @returns Boolean indicating success
 */
export async function awardAchievement(
  userId: string,
  achievementId: number,
): Promise<boolean> {
  try {
    await ensureDbInitialized();

    if (!db) {
      console.error('Database not initialized, cannot award achievement');
      return false;
    }

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
      if (existing.earnedAt) {
        return false;
      }

      await db
        .update(schema.userAchievementsTable)
        .set({
          earnedAt: new Date(),
          progress: 100,
        })
        .where(eq(schema.userAchievementsTable.id, existing.id));
    } else {
      await db.insert(schema.userAchievementsTable).values({
        discordId: userId,
        achievementId: achievementId,
        earnedAt: new Date(),
        progress: 100,
      });
    }

    return true;
  } catch (error) {
    handleDbError('Failed to award achievement', error as Error);
    return false;
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
      await db
        .update(schema.userAchievementsTable)
        .set({ progress })
        .where(eq(schema.userAchievementsTable.id, existing.id));
    } else {
      await db.insert(schema.userAchievementsTable).values({
        discordId: userId,
        achievementId,
        progress,
      });
    }

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
    return true;
  } catch (error) {
    handleDbError('Failed to remove user achievement', error as Error);
    return false;
  }
}
